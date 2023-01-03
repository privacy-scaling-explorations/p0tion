#!/usr/bin/env node
import crypto from "crypto"
import { zKey } from "snarkjs"
import open from "open"
import {
    getBucketName,
    getCeremonyCircuits,
    getContributorContributionsVerificationResults,
    getValidContributionAttestation,
    multiPartUpload,
    checkAndMakeNewDirectoryIfNonexistent,
    readFile,
    writeFile,
    writeLocalJsonFile
} from "@zkmpc/actions"
import { httpsCallable } from "firebase/functions"
import { handleCurrentAuthUserSignIn, onlyCoordinator } from "../lib/auth"
import { collections, emojis, paths, solidityVersion, symbols, theme } from "../lib/constants"
import { GENERIC_ERRORS, showError } from "../lib/errors"
import { askForCeremonySelection, getEntropyOrBeacon } from "../lib/prompts"
import { getClosedCeremonies } from "../lib/queries"
import {
    bootstrapCommandExec,
    customSpinner,
    getLocalFilePath,
    makeContribution,
    publishGist,
    sleep,
    terminate
} from "../lib/utils"
import { getDocumentById } from "../lib/firebase"

/**
 * Finalize command.
 */
const finalize = async () => {
    try {
        if (!process.env.CONFIG_CEREMONY_BUCKET_POSTFIX) showError(GENERIC_ERRORS.GENERIC_NOT_CONFIGURED_PROPERLY, true)
        if (!process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS)
            showError(GENERIC_ERRORS.GENERIC_NOT_CONFIGURED_PROPERLY, true)

        // Initialize services.
        const { firebaseApp, firebaseFunctions, firestoreDatabase } = await bootstrapCommandExec()

        // Setup ceremony callable Cloud Function initialization.
        const checkAndPrepareCoordinatorForFinalization = httpsCallable(
            firebaseFunctions,
            "checkAndPrepareCoordinatorForFinalization"
        )
        const finalizeLastContribution = httpsCallable(firebaseFunctions, "finalizeLastContribution")
        const finalizeCeremony = httpsCallable(firebaseFunctions, "finalizeCeremony")

        // Handle current authenticated user sign in.
        const { user, token, username } = await handleCurrentAuthUserSignIn(firebaseApp)

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
        const circuits = await getCeremonyCircuits(firestoreDatabase, ceremony.id)

        // Attestation preamble.
        const attestationPreamble = `Hey, I'm ${username} and I have finalized the ${ceremony.data.title} MPC Phase2 Trusted Setup ceremony.\nThe following are the finalization signatures:`

        // Finalize each circuit
        for await (const circuit of circuits) {
            await makeContribution(ceremony, circuit, beaconHashStr, username, true, firebaseFunctions)

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
            const bucketName = getBucketName(ceremony.data.prefix, process.env.CONFIG_CEREMONY_BUCKET_POSTFIX!)

            await multiPartUpload(
                firebaseFunctions,
                bucketName,
                verificationKeyStoragePath,
                verificationKeyLocalPath,
                process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "50",
                process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS || 7200
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
                {
                    groth16: readFile(
                        getLocalFilePath(`/../../../../node_modules/snarkjs/templates/verifier_groth16.sol.ejs`)
                    )
                },
                console
            )

            // Update solidity version.
            verifierCode = verifierCode.replace(
                /pragma solidity \^\d+\.\d+\.\d+/,
                `pragma solidity ^${solidityVersion}`
            )

            spinner.text = `Writing verifier contract locally...`

            // Write locally.
            writeFile(verifierContractLocalPath, verifierCode)

            // nb. need to wait for closing the file descriptor.
            await sleep(1500)

            // Upload vkey to storage.
            await multiPartUpload(
                firebaseFunctions,
                bucketName,
                verifierContractStoragePath,
                verifierContractLocalPath,
                process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "50",
                process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS || 7200
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
        const updatedParticipantDoc = await getDocumentById(`ceremonies/${ceremony.id}/participants`, participantDoc.id)

        if (!updatedParticipantDoc.data()) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

        // Return true and false based on contribution verification.
        const contributionsValidity = await getContributorContributionsVerificationResults(
            firestoreDatabase,
            ceremony.id,
            updatedParticipantDoc.id,
            circuits,
            true
        )

        // Get only valid contribution hashes.
        const attestation = await getValidContributionAttestation(
            firestoreDatabase,
            contributionsValidity,
            circuits,
            updatedParticipantDoc.data(),
            ceremony.id,
            participantDoc.id,
            attestationPreamble,
            true
        )

        writeFile(
            `${paths.finalAttestationsPath}/${ceremony.data.prefix}_final_attestation.log`,
            Buffer.from(attestation)
        )

        // nb. wait for closing file descriptor.
        await sleep(1000)

        spinner.text = `Uploading public finalization attestation as Github Gist...`

        const gistUrl = await publishGist(token, attestation, ceremony.data.prefix, ceremony.data.title)

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

        terminate(username)
    } catch (err: any) {
        showError(`Something went wrong: ${err.toString()}`, true)
    }
}

export default finalize
