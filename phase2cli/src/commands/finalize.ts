#!/usr/bin/env node

import { zKey } from "snarkjs"
import crypto from "crypto"
import open from "open"
import { httpsCallable } from "firebase/functions"
import { handleAuthUserSignIn, onlyCoordinator } from "../lib/auth.js"
import { collections, emojis, paths, solidityVersion, symbols, theme } from "../lib/constants.js"
import { showError } from "../lib/errors.js"
import { cleanDir, directoryExists, readFile, writeFile, writeLocalJsonFile } from "../lib/files.js"
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
      `You are about to finalize your Phase 2 Trusted Setup ceremony ${emojis.tada}\nThis process could take the bulk of your computational resources and memory for quite a long time based on the size and number of circuits ${emojis.fire}\n`
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
    console.log(`${symbols.info} Beacon hash string ${beaconHashStr}`)

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

      let spinner = customSpinner(`Exporting verification key...`, "clock")
      spinner.start()

      // Export vkey.
      const verificationKeyJSONData = await zKey.exportVerificationKey(finalZkeyLocalPath)
      spinner.stop()

      spinner = customSpinner(`Storing verification key locally...`, "clock")
      spinner.start()

      // Write locally.
      writeLocalJsonFile(verificationKeyLocalPath, verificationKeyJSONData)
      await sleep(1000)

      spinner.stop()
      console.log(`${symbols.success} Verification key correctly extracted ${emojis.key}`)

      spinner = customSpinner(`Uploading verification key...`, "clock")
      spinner.start()

      // Upload vkey to storage.
      await uploadFileToStorage(verificationKeyLocalPath, verificationKeyStoragePath)

      spinner.stop()
      console.log(`${symbols.success} Verification key correctly uploaded`)

      // 7. Turn the verifier into a smart contract.
      const verifierContractLocalPath = `${paths.verifierContractsPath}/${circuit.data.name}_verifier.sol`
      const verifierContractStoragePath = `${ceremony.data.prefix}/${collections.circuits}/${circuit.data.prefix}/${circuit.data.prefix}_verifier.sol`

      spinner = customSpinner(`Exporting Verifier smart contract...`, "clock")
      spinner.start()

      // Export solidity verifier.
      let verifierCode = await zKey.exportSolidityVerifier(
        finalZkeyLocalPath,
        { groth16: readFile("../node_modules/snarkjs/templates/verifier_groth16.sol.ejs") },
        console
      )

      spinner.stop()
      console.log(`${symbols.success} Verifier smart contract correctly exported`)

      // Update solidity version.
      verifierCode = verifierCode.replace(/pragma solidity \^\d+\.\d+\.\d+/, `pragma solidity ^${solidityVersion}`)

      spinner = customSpinner(`Storing Verifier smart contract locally...`, "clock")
      spinner.start()

      // Write locally.
      writeFile(verifierContractLocalPath, verifierCode)
      await sleep(1000)

      spinner.stop()
      console.log(`${symbols.success} Verifier smart contract correctly stored`)

      spinner = customSpinner(`Uploading Verifier smart contract...`, "clock")
      spinner.start()

      // Upload vkey to storage.
      await uploadFileToStorage(verifierContractLocalPath, verifierContractStoragePath)

      spinner.stop()
      console.log(`${symbols.success} Verifier smart contract correctly uploaded`)

      spinner = customSpinner(`Finalizing circuit...`, "clock")
      spinner.start()

      // Finalize circuit contribution.
      await finalizeCircuit({
        ceremonyId: ceremony.id,
        circuitId: circuit.id
      })

      await sleep(2000)

      spinner.stop()
      console.log(`${symbols.success} Circuit finalization completed ${emojis.tada}`)
    }

    let spinner = customSpinner(`Finalizing ceremony...`, "clock")
    spinner.start()

    // Setup ceremony on the server.
    await finalizeCeremony({
      ceremonyId: ceremony.id
    })
    await sleep(2000)

    spinner.stop()
    console.log(`${symbols.success} Ceremony finalization completed ${emojis.tada}`)

    // Check if participant has finished the contribution for each circuit.
    console.log(
      `\nCongratulations @${theme.bold(ghUsername)}! ${emojis.tada} You have correctly finalized the ${theme.magenta(
        ceremony.data.title
      )} circuits!`
    )

    spinner = customSpinner("Generating public final attestation...", "clock")
    spinner.start()

    writeFile(`${paths.finalAttestationsPath}/${ceremony.data.prefix}_final_attestation.log`, Buffer.from(attestation))

    spinner.stop()

    console.log(`\n${symbols.success} Public final attestation ready to be published`)

    spinner = customSpinner("Uploading public final attestation as Github Gist...", "clock")
    spinner.start()

    const gistUrl = await publishGist(ghToken, attestation, ceremony.data.prefix, ceremony.data.title)

    // TODO: If fails for permissions problems, ask to do manually.

    spinner.stop()
    console.log(
      `${symbols.success} Public attestation ${theme.bold(
        theme.underlined(gistUrl)
      )} successfully published on Github ${emojis.tada}`
    )

    // Attestation link via Twitter.
    const attestationTweet = `I%20have%20finalized%20the%20MACI%20Phase%20Trusted%20Setup%20ceremony!%20You%20can%20view%20my%20final%20attestation%20here:%20${gistUrl}%20#Ethereum%20#ZKP%20#PSE`

    await open(`http://twitter.com/intent/tweet?text=${attestationTweet}`)

    terminate(ghUsername)
  } catch (err: any) {
    showError(`Something went wrong: ${err.toString()}`, true)
  }
}

export default finalize
