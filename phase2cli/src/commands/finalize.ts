#!/usr/bin/env node
import crypto from "crypto"
import { zKey } from "snarkjs"
import open from "open"
import { httpsCallable } from "firebase/functions"
import { handleAuthUserSignIn, onlyCoordinator } from "../lib/auth.js"
import { collections, emojis, paths, solidityVersion, symbols, theme } from "../lib/constants.js"
import { GENERIC_ERRORS, showError } from "../lib/errors.js"
import {
  checkAndMakeNewDirectoryIfNonexistent,
  getLocalFilePath,
  readFile,
  writeFile,
  writeLocalJsonFile
} from "../lib/files.js"
import { askForCeremonySelection } from "../lib/prompts.js"
import { getCeremonyCircuits, getClosedCeremonies } from "../lib/queries.js"
import {
  bootstrapCommandExec,
  customSpinner,
  getBucketName,
  getContributorContributionsVerificationResults,
  getEntropyOrBeacon,
  getValidContributionAttestation,
  makeContribution,
  multiPartUpload,
  publishGist,
  sleep,
  terminate
} from "../lib/utils.js"
import { getDocumentById } from "../lib/firebase.js"

/**
 * Finalize command.
 */
const finalize = async () => {
  try {
    // Initialize services.
    const { firebaseFunctions } = await bootstrapCommandExec()

    // Setup ceremony callable Cloud Function initialization.
    const checkAndPrepareCoordinatorForFinalization = httpsCallable(
      firebaseFunctions,
      "checkAndPrepareCoordinatorForFinalization"
    )
    const finalizeLastContribution = httpsCallable(firebaseFunctions, "finalizeLastContribution")
    const finalizeCeremony = httpsCallable(firebaseFunctions, "finalizeCeremony")

    // Handle authenticated user sign in.
    const { user, ghUsername, ghToken } = await handleAuthUserSignIn()

    // Check custom claims for coordinator role.
    await onlyCoordinator(user)

    // Get closed cerimonies info (if any).
    const closedCeremoniesDocs = await getClosedCeremonies()

    console.log(
      `${symbols.warning} The computation of the final contribution could take the bulk of your computational resources and memory based on the size of the circuit ${emojis.fire}\n`
    )

    // Ask to select a ceremony.
    const ceremony = await askForCeremonySelection(closedCeremoniesDocs)

    // Get coordinator participant document.
    const participantDoc = await getDocumentById(
      `${collections.ceremonies}/${ceremony.id}/${collections.participants}`,
      user.uid
    )

    const { data: canFinalize } = await checkAndPrepareCoordinatorForFinalization({ ceremonyId: ceremony.id })

    if (!canFinalize) showError(`You are not able to finalize the ceremony`, true)

    // Clean directories.
    checkAndMakeNewDirectoryIfNonexistent(paths.outputPath)
    checkAndMakeNewDirectoryIfNonexistent(paths.finalizePath)
    checkAndMakeNewDirectoryIfNonexistent(paths.finalZkeysPath)
    checkAndMakeNewDirectoryIfNonexistent(paths.finalPotPath)
    checkAndMakeNewDirectoryIfNonexistent(paths.finalAttestationsPath)
    checkAndMakeNewDirectoryIfNonexistent(paths.verificationKeysPath)
    checkAndMakeNewDirectoryIfNonexistent(paths.verifierContractsPath)

    // Handle random beacon request/generation.
    const beacon = await getEntropyOrBeacon(false)
    const beaconHashStr = crypto.createHash("sha256").update(beacon).digest("hex")
    console.log(`${symbols.info} Your final beacon hash: ${theme.bold(beaconHashStr)}`)

    // Get ceremony circuits.
    const circuits = await getCeremonyCircuits(ceremony.id)

    // Attestation preamble.
    const attestationPreamble = `Hey, I'm ${ghUsername} and I have finalized the ${ceremony.data.title} MPC Phase2 Trusted Setup ceremony.\nThe following are the finalization signatures:`

    // Finalize each circuit
    for await (const circuit of circuits) {
      await makeContribution(ceremony, circuit, beaconHashStr, ghUsername, true, firebaseFunctions)

      // 6. Export the verification key.

      // Paths config.
      const finalZkeyLocalPath = `${paths.finalZkeysPath}/${circuit.data.prefix}_final.zkey`
      const verificationKeyLocalPath = `${paths.verificationKeysPath}/${circuit.data.prefix}_vkey.json`
      const verificationKeyStoragePath = `${collections.circuits}/${circuit.data.prefix}/${circuit.data.prefix}_vkey.json`

      const spinner = customSpinner(`Extracting verification key...`, "clock")
      spinner.start()

      // Export vkey.
      const verificationKeyJSONData = await zKey.exportVerificationKey(finalZkeyLocalPath)

      spinner.text = `Writing verification key locally...`

      // Write locally.
      writeLocalJsonFile(verificationKeyLocalPath, verificationKeyJSONData)

      // nb. need to wait for closing the file descriptor.
      await sleep(1500)

      // Upload vkey to storage.
      const startMultiPartUpload = httpsCallable(firebaseFunctions, "startMultiPartUpload")
      const generatePreSignedUrlsParts = httpsCallable(firebaseFunctions, "generatePreSignedUrlsParts")
      const completeMultiPartUpload = httpsCallable(firebaseFunctions, "completeMultiPartUpload")

      const bucketName = getBucketName(ceremony.data.prefix)

      await multiPartUpload(
        startMultiPartUpload,
        generatePreSignedUrlsParts,
        completeMultiPartUpload,
        bucketName,
        verificationKeyStoragePath,
        verificationKeyLocalPath
      )

      spinner.succeed(`Verification key correctly stored`)

      // 7. Turn the verifier into a smart contract.
      const verifierContractLocalPath = `${paths.verifierContractsPath}/${circuit.data.name}_verifier.sol`
      const verifierContractStoragePath = `${collections.circuits}/${circuit.data.prefix}/${circuit.data.prefix}_verifier.sol`

      spinner.text = `Extracting verifier contract...`
      spinner.start()

      // Export solidity verifier.
      let verifierCode = await zKey.exportSolidityVerifier(
        finalZkeyLocalPath,
        { groth16: readFile(getLocalFilePath("../../../node_modules/snarkjs/templates/verifier_groth16.sol.ejs")) },
        console
      )

      // Update solidity version.
      verifierCode = verifierCode.replace(/pragma solidity \^\d+\.\d+\.\d+/, `pragma solidity ^${solidityVersion}`)

      spinner.text = `Writing verifier contract locally...`

      // Write locally.
      writeFile(verifierContractLocalPath, verifierCode)

      // nb. need to wait for closing the file descriptor.
      await sleep(1500)

      // Upload vkey to storage.
      await multiPartUpload(
        startMultiPartUpload,
        generatePreSignedUrlsParts,
        completeMultiPartUpload,
        bucketName,
        verifierContractStoragePath,
        verifierContractLocalPath
      )
      spinner.succeed(`Verifier contract correctly stored`)

      spinner.text = `Finalizing circuit...`
      spinner.start()

      // Finalize circuit contribution.
      await finalizeLastContribution({
        ceremonyId: ceremony.id,
        circuitId: circuit.id,
        bucketName
      })

      spinner.succeed(`Circuit successfully finalized`)
    }

    process.stdout.write(`\n`)

    const spinner = customSpinner(`Finalizing the ceremony...`, "clock")
    spinner.start()

    // Setup ceremony on the server.
    await finalizeCeremony({
      ceremonyId: ceremony.id
    })

    spinner.succeed(
      `Congrats, you have correctly finalized the ${theme.bold(ceremony.data.title)} circuits ${emojis.tada}\n`
    )

    spinner.text = `Generating public finalization attestation...`
    spinner.start()

    // Get updated participant data.
    const participantData = participantDoc.data()

    if (!participantData) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

    // Return true and false based on contribution verification.
    const contributionsValidity = await getContributorContributionsVerificationResults(
      ceremony.id,
      participantDoc.id,
      circuits,
      true
    )

    // Get only valid contribution hashes.
    const attestation = await getValidContributionAttestation(
      contributionsValidity,
      circuits,
      participantData!,
      ceremony.id,
      participantDoc.id,
      attestationPreamble,
      true
    )

    writeFile(`${paths.finalAttestationsPath}/${ceremony.data.prefix}_final_attestation.log`, Buffer.from(attestation))

    // nb. wait for closing file descriptor.
    await sleep(1000)

    spinner.text = `Uploading public finalization attestation as Github Gist...`

    const gistUrl = await publishGist(ghToken, attestation, ceremony.data.prefix, ceremony.data.title)

    spinner.succeed(
      `Public finalization attestation successfully published as Github Gist at this link ${theme.bold(
        theme.underlined(gistUrl)
      )}`
    )

    // Attestation link via Twitter.
    const attestationTweet = `https://twitter.com/intent/tweet?text=I%20have%20finalized%20the%20${ceremony.data.title}%20Phase%202%20Trusted%20Setup%20ceremony!%20You%20can%20view%20my%20final%20attestation%20here:%20${gistUrl}%20#Ethereum%20#ZKP%20#PSE`

    console.log(
      `\nYou can tweet about the ceremony finalization if you'd like (click on the link below ${
        emojis.pointDown
      }) \n\n${theme.underlined(attestationTweet)}`
    )

    await open(attestationTweet)

    terminate(ghUsername)
  } catch (err: any) {
    showError(`Something went wrong: ${err.toString()}`, true)
  }
}

export default finalize
