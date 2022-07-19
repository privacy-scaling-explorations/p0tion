#!/usr/bin/env node

import { zKey } from "snarkjs"
import crypto from "crypto"
import open from "open"
import { httpsCallable } from "firebase/functions"
import { handleAuthUserSignIn, onlyCoordinator } from "../lib/auth.js"
import { collections, emojis, paths, solidityVersion, symbols, theme } from "../lib/constants.js"
import { showError } from "../lib/errors.js"
import { cleanDir, directoryExists, readLocalFile, writeFile, writeLocalJsonFile } from "../lib/files.js"
import { askForCeremonySelection } from "../lib/prompts.js"
import { getCeremonyCircuits, getClosedCeremonies } from "../lib/queries.js"
import {
  bootstrapCommandExec,
  customSpinner,
  getEntropyOrBeacon,
  makeContribution,
  publishGist,
  sleep,
  terminate
} from "../lib/utils.js"
import { uploadFileToStorage } from "../lib/firebase.js"

/**
 * Finalize command.
 */
const finalize = async () => {
  try {
    // Initialize services.
    const { firebaseFunctions } = await bootstrapCommandExec()

    // Setup ceremony callable Cloud Function initialization.
    const finalizeCircuit = httpsCallable(firebaseFunctions, "finalizeCircuit")
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

    // Check for output directory.
    if (!directoryExists(paths.outputPath)) cleanDir(paths.outputPath)

    // Clean directories.
    cleanDir(paths.finalizePath)
    cleanDir(paths.finalZkeysPath)
    cleanDir(paths.finalPotPath)
    cleanDir(paths.finalAttestationsPath)
    cleanDir(paths.verificationKeysPath)
    cleanDir(paths.verifierContractsPath)

    // Handle random beacon request/generation.
    const beacon = await getEntropyOrBeacon(false)
    const beaconHashStr = crypto.createHash("sha256").update(beacon).digest("hex")
    console.log(`${symbols.info} Beacon Hash: ${theme.bold(beaconHashStr)}`)

    // Get ceremony circuits.
    const circuits = await getCeremonyCircuits(ceremony.id)

    // Attestation preamble.
    let attestation = `Hey, I'm ${ghUsername} and I have finalized the ${ceremony.data.title} MPC Phase2 Trusted Setup ceremony.\nThe following are the finalization signatures:`

    // Finalize each circuit
    for await (const circuit of circuits) {
      attestation = await makeContribution(
        ceremony,
        circuit,
        beaconHashStr,
        ghUsername,
        true,
        attestation,
        firebaseFunctions
      )

      // 6. Export the verification key.

      // Paths config.
      const finalZkeyLocalPath = `${paths.finalZkeysPath}/${circuit.data.prefix}_final.zkey`
      const verificationKeyLocalPath = `${paths.verificationKeysPath}/${circuit.data.prefix}_vkey.json`
      const verificationKeyStoragePath = `${ceremony.data.prefix}/${collections.circuits}/${circuit.data.prefix}/${circuit.data.prefix}_vkey.json`

      let spinner = customSpinner(`Extracting verification key...`, "clock")
      spinner.start()

      // Export vkey.
      const verificationKeyJSONData = await zKey.exportVerificationKey(finalZkeyLocalPath)
      spinner.stop()

      spinner = customSpinner(`Writing verification key locally...`, "clock")
      spinner.start()

      // Write locally.
      writeLocalJsonFile(verificationKeyLocalPath, verificationKeyJSONData)
      await sleep(1000)

      spinner.stop()

      spinner = customSpinner(`Storing verification key...`, "clock")
      spinner.start()

      // Upload vkey to storage.
      await uploadFileToStorage(verificationKeyLocalPath, verificationKeyStoragePath)

      spinner.stop()
      console.log(`${symbols.success} Verification key correctly stored`)

      // 7. Turn the verifier into a smart contract.
      const verifierContractLocalPath = `${paths.verifierContractsPath}/${circuit.data.name}_verifier.sol`
      const verifierContractStoragePath = `${ceremony.data.prefix}/${collections.circuits}/${circuit.data.prefix}/${circuit.data.prefix}_verifier.sol`

      spinner = customSpinner(`Extracting verifier contract...`, "clock")
      spinner.start()

      // Export solidity verifier.
      let verifierCode = await zKey.exportSolidityVerifier(
        finalZkeyLocalPath,
        { groth16: readLocalFile("../../../node_modules/snarkjs/templates/verifier_groth16.sol.ejs") },
        console
      )

      spinner.stop()

      // Update solidity version.
      verifierCode = verifierCode.replace(/pragma solidity \^\d+\.\d+\.\d+/, `pragma solidity ^${solidityVersion}`)

      spinner = customSpinner(`Writing verifier contract locally...`, "clock")
      spinner.start()

      // Write locally.
      writeFile(verifierContractLocalPath, verifierCode)
      await sleep(1000)

      spinner.stop()

      spinner = customSpinner(`Storing verifier smart contract...`, "clock")
      spinner.start()

      // Upload vkey to storage.
      await uploadFileToStorage(verifierContractLocalPath, verifierContractStoragePath)

      spinner.stop()
      console.log(`${symbols.success} Verifier contract correctly stored`)

      spinner = customSpinner(`Finalizing circuit...`, "clock")
      spinner.start()

      // Finalize circuit contribution.
      await finalizeCircuit({
        ceremonyId: ceremony.id,
        circuitId: circuit.id
      })

      await sleep(2000)

      spinner.stop()
      console.log(`${symbols.success} Circuit successfully finalized`)
    }

    process.stdout.write(`\n`)
    let spinner = customSpinner(`Finalizing the ceremony...`, "clock")
    spinner.start()

    // Setup ceremony on the server.
    await finalizeCeremony({
      ceremonyId: ceremony.id
    })
    await sleep(2000)

    spinner.stop()
    // Check if participant has finished the contribution for each circuit.
    console.log(
      `Congrats, you have correctly finalized the ${theme.bold(ceremony.data.title)} circuits ${emojis.tada}\n`
    )

    spinner = customSpinner("Generating public finalization attestation...", "clock")
    spinner.start()

    writeFile(`${paths.finalAttestationsPath}/${ceremony.data.prefix}_final_attestation.log`, Buffer.from(attestation))

    spinner.stop()

    spinner = customSpinner("Uploading public finalization attestation as Github Gist...", "clock")
    spinner.start()

    const gistUrl = await publishGist(ghToken, attestation, ceremony.data.prefix, ceremony.data.title)

    // TODO: If fails for permissions problems, ask to do manually.

    spinner.stop()
    console.log(
      `${
        symbols.success
      } Public finalization attestation successfully published as Github Gist at this link ${theme.bold(
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
