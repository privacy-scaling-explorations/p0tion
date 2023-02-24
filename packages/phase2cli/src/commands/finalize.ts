#!/usr/bin/env node
import crypto from "crypto"
import { zKey } from "snarkjs"
import open from "open"
import {
    isCoordinator,
    getClosedCeremonies,
    getDocumentById,
    getParticipantsCollectionPath,
    checkAndPrepareCoordinatorForFinalization,
    getCeremonyCircuits,
    getVerificationKeyStorageFilePath,
    getBucketName,
    multiPartUpload,
    getVerifierContractStorageFilePath,
    solidityVersion,
    finalizeLastContribution,
    finalizeCeremony,
    generateValidContributionsAttestation,
    commonTerms,
    finalContributionIndex
} from "@zkmpc/actions/src"
import { COMMAND_ERRORS, GENERIC_ERRORS, showError } from "../lib/errors"
import { customSpinner, handleStartOrResumeContribution, publishGist, sleep, terminate } from "../lib/utils"
import { bootstrapCommandExecutionAndServices, checkAuth } from "../lib/services"
import {
    getFinalAttestationLocalFilePath,
    getFinalZkeyLocalFilePath,
    getVerificationKeyLocalFilePath,
    getVerifierContractLocalFilePath,
    localPaths
} from "../lib/localConfigs"
import theme from "../lib/theme"
import {
    checkAndMakeNewDirectoryIfNonexistent,
    writeLocalJsonFile,
    readFile,
    writeFile,
    getLocalFilePath
} from "../lib/files"
import { promptForCeremonySelection, promptToTypeEntropyOrBeacon } from "../lib/prompts"

/**
 * Finalize command.
 */
const finalize = async () => {
    try {
        // Initialize services.
        const { firebaseApp, firebaseFunctions, firestoreDatabase } = await bootstrapCommandExecutionAndServices()

        // Handle current authenticated user sign in.
        const { user, token, handle } = await checkAuth(firebaseApp)

        // Preserve command execution only for coordinators].
        if (!(await isCoordinator(user))) showError(COMMAND_ERRORS.COMMAND_NOT_COORDINATOR, true)

        // Get closed cerimonies info (if any).
        const closedCeremoniesDocs = await getClosedCeremonies(firestoreDatabase)

        console.log(
            `${theme.symbols.warning} The computation of the final contribution could take the bulk of your computational resources and memory based on the size of the circuit ${theme.emojis.fire}\n`
        )

        // Ask to select a ceremony.
        const ceremony = await promptForCeremonySelection(closedCeremoniesDocs)

        // Get coordinator participant document.
        const participantDoc = await getDocumentById(
            firestoreDatabase,
            getParticipantsCollectionPath(ceremony.id),
            user.uid
        )

        const { data: canFinalize } = await checkAndPrepareCoordinatorForFinalization(firebaseFunctions, ceremony.id)

        if (!canFinalize) showError(`You are not able to finalize the ceremony`, true)

        // Clean directories.
        checkAndMakeNewDirectoryIfNonexistent(localPaths.output)
        checkAndMakeNewDirectoryIfNonexistent(localPaths.finalize)
        checkAndMakeNewDirectoryIfNonexistent(localPaths.finalZkeys)
        checkAndMakeNewDirectoryIfNonexistent(localPaths.finalPot)
        checkAndMakeNewDirectoryIfNonexistent(localPaths.finalAttestations)
        checkAndMakeNewDirectoryIfNonexistent(localPaths.verificationKeys)
        checkAndMakeNewDirectoryIfNonexistent(localPaths.verifierContracts)

        // Handle random beacon request/generation.
        const beacon = await promptToTypeEntropyOrBeacon(false)
        const beaconHashStr = crypto.createHash("sha256").update(beacon).digest("hex")
        console.log(`${theme.symbols.info} Your final beacon hash: ${theme.text.bold(beaconHashStr)}`)

        // Get ceremony circuits.
        const circuits = await getCeremonyCircuits(firestoreDatabase, ceremony.id)

        // Finalize each circuit
        for await (const circuit of circuits) {
            await handleStartOrResumeContribution(
                firebaseFunctions,
                firestoreDatabase,
                ceremony,
                circuit,
                participantDoc,
                beaconHashStr,
                handle,
                true
            )

            // 6. Export the verification key.

            // Paths config.
            const finalZkeyLocalPath = getFinalZkeyLocalFilePath(
                `${circuit.data.prefix}_${finalContributionIndex}.zkey`
            )
            const verificationKeyLocalPath = getVerificationKeyLocalFilePath(`${circuit.data.prefix}_vkey.json`)
            const verificationKeyStoragePath = getVerificationKeyStorageFilePath(
                circuit.data.prefix,
                `${circuit.data.prefix}_vkey.json`
            )

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
                Number(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB)
            )

            spinner.succeed(`Verification key correctly stored`)

            // 7. Turn the verifier into a smart contract.
            const verifierContractLocalPath = getVerifierContractLocalFilePath(`${circuit.data.prefix}_verifier.sol`)
            const verifierContractStoragePath = getVerifierContractStorageFilePath(
                circuit.data.prefix,
                `${circuit.data.prefix}_verifier.sol`
            )

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
                Number(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB)
            )
            spinner.succeed(`Verifier contract correctly stored`)

            spinner.text = `Finalizing circuit...`
            spinner.start()

            // Finalize circuit contribution.
            await finalizeLastContribution(firebaseFunctions, ceremony.id, circuit.id, bucketName)

            spinner.succeed(`Circuit successfully finalized`)
        }

        process.stdout.write(`\n`)

        const spinner = customSpinner(`Finalizing the ceremony...`, "clock")
        spinner.start()

        // Setup ceremony on the server.
        await finalizeCeremony(firebaseFunctions, ceremony.id)

        spinner.succeed(
            `Congrats, you have correctly finalized the ${theme.text.bold(ceremony.data.title)} circuits ${
                theme.emojis.tada
            }\n`
        )

        spinner.text = `Generating public finalization attestation...`
        spinner.start()

        // Get updated participant data.
        const updatedParticipantDoc = await getDocumentById(
            firestoreDatabase,
            getParticipantsCollectionPath(ceremony.id),
            participantDoc.id
        )

        if (!updatedParticipantDoc.data()) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

        // Get only valid contribution hashes.
        const attestation = await generateValidContributionsAttestation(
            firestoreDatabase,
            circuits,
            ceremony.id,
            updatedParticipantDoc.id,
            updatedParticipantDoc.data()!.contributions,
            handle,
            ceremony.data.name,
            true
        )

        writeFile(
            getFinalAttestationLocalFilePath(
                `${ceremony.data.prefix}_${finalContributionIndex}_${commonTerms.foldersAndPathsTerms.attestation}.log`
            ),
            Buffer.from(attestation)
        )

        // nb. wait for closing file descriptor.
        await sleep(1000)

        spinner.text = `Uploading public finalization attestation as Github Gist...`

        const gistUrl = await publishGist(token, attestation, ceremony.data.prefix, ceremony.data.title)

        spinner.succeed(
            `Public finalization attestation successfully published as Github Gist at this link ${theme.text.bold(
                theme.text.underlined(gistUrl)
            )}`
        )

        // Attestation link via Twitter.
        const attestationTweet = `https://twitter.com/intent/tweet?text=I%20have%20finalized%20the%20${ceremony.data.title}%20Phase%202%20Trusted%20Setup%20ceremony!%20You%20can%20view%20my%20final%20attestation%20here:%20${gistUrl}%20#Ethereum%20#ZKP%20#PSE`

        console.log(
            `\nYou can tweet about the ceremony finalization if you'd like (click on the link below ${
                theme.emojis.pointDown
            }) \n\n${theme.text.underlined(attestationTweet)}`
        )

        await open(attestationTweet)

        terminate(handle)
    } catch (err: any) {
        showError(`Something went wrong: ${err.toString()}`, true)
    }
}

export default finalize
