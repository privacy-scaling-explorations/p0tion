#!/usr/bin/env node
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
    finalizeCeremony,
    generateValidContributionsAttestation,
    commonTerms,
    finalContributionIndex,
    computeSHA256ToHex,
    finalizeCircuit,
    verificationKeyAcronym,
    verifierSmartContractAcronym,
    exportVerifierContract,
    exportVkey
} from "@zkmpc/actions/src"
import { Functions } from "firebase/functions"
import { Firestore } from "firebase/firestore"
import { FirebaseDocumentInfo } from "@zkmpc/actions/src/types"
import { COMMAND_ERRORS, showError } from "../lib/errors"
import {
    customSpinner,
    generateCustomUrlToTweetAboutParticipation,
    handleStartOrResumeContribution,
    publishGist,
    sleep,
    terminate
} from "../lib/utils"
import { bootstrapCommandExecutionAndServices, checkAuth } from "../lib/services"
import {
    getAttestationLocalFilePath,
    getFinalZkeyLocalFilePath,
    getVerificationKeyLocalFilePath,
    getVerifierContractLocalFilePath,
    localPaths
} from "../lib/localConfigs"
import theme from "../lib/theme"
import { checkAndMakeNewDirectoryIfNonexistent, writeLocalJsonFile, writeFile, getLocalFilePath } from "../lib/files"
import { promptForCeremonySelection, promptToTypeEntropyOrBeacon } from "../lib/prompts"

/**
 * Export and store on the ceremony bucket the verification key for the given final contribution.
 * @param cloudFunctions <Functions> - the instance of the Firebase cloud functions for the application.
 * @param bucketName <string> - the name of the ceremony bucket.
 * @param finalZkeyLocalFilePath <string> - the local file path of the final zKey.
 * @param verificationKeyLocalFilePath <string> - the local file path of the verification key.
 * @param verificationKeyStorageFilePath <string> - the storage file path of the verification key.
 */
const handleVerificationKey = async (
    cloudFunctions: Functions,
    bucketName: string,
    finalZkeyLocalFilePath: string,
    verificationKeyLocalFilePath: string,
    verificationKeyStorageFilePath: string
) => {
    const spinner = customSpinner(`Exporting the verification key...`, "clock")
    spinner.start()

    // Export the verification key.
    const vKey = await exportVkey(finalZkeyLocalFilePath)

    spinner.text = "Writing verification key..."

    // Write the verification key locally.
    writeLocalJsonFile(verificationKeyLocalFilePath, vKey)

    await sleep(3000) // workaound for file descriptor.

    // Upload verification key to storage.
    await multiPartUpload(
        cloudFunctions,
        bucketName,
        verificationKeyStorageFilePath,
        verificationKeyLocalFilePath,
        Number(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB)
    )

    spinner.succeed(`Verification key correctly saved on storage`)
}

/**
 * Derive and store on the ceremony bucket the Solidity Verifier smart contract for the given final contribution.
 * @param cloudFunctions <Functions> - the instance of the Firebase cloud functions for the application.
 * @param bucketName <string> - the name of the ceremony bucket.
 * @param finalZkeyLocalFilePath <string> - the local file path of the final zKey.
 * @param verifierContractLocalFilePath <string> - the local file path of the verifier smart contract.
 * @param verifierContractStorageFilePath <string> - the storage file path of the verifier smart contract.
 */
const handleVerifierSmartContract = async (
    cloudFunctions: Functions,
    bucketName: string,
    finalZkeyLocalFilePath: string,
    verifierContractLocalFilePath: string,
    verifierContractStorageFilePath: string
) => {
    const spinner = customSpinner(`Extracting verifier contract...`, `clock`)
    spinner.start()

    // Export the Solidity verifier smart contract.
    const verifierCode = await exportVerifierContract(
        solidityVersion,
        finalZkeyLocalFilePath,
        getLocalFilePath(`/../../../../node_modules/snarkjs/templates/verifier_groth16.sol.ejs`)
    )

    spinner.text = `Writing verifier smart contract...`

    // Write the verification key locally.
    writeFile(verifierContractLocalFilePath, verifierCode)

    await sleep(3000) // workaound for file descriptor.

    // Upload verifier smart contract to storage.
    await multiPartUpload(
        cloudFunctions,
        bucketName,
        verifierContractStorageFilePath,
        verifierContractLocalFilePath,
        Number(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB)
    )

    spinner.succeed(`Verifier smart contract correctly saved on storage`)
}

/**
 * Handle the process of finalizing a ceremony circuit.
 * @dev this process results in the extraction of the final ceremony artifacts for the calculation and verification of proofs.
 * @notice this method must enforce the order among these steps:
 * 1) Compute the final contribution (zKey).
 * 2) Extract the verification key (vKey).
 * 3) Extract the Verifier smart contract (.sol).
 * 4) Upload the artifacts in the AWS S3 storage.
 * 5) Complete the final contribution data w/ artifacts references and hashes (cloud function).
 * @param cloudFunctions <Functions> - the instance of the Firebase cloud functions for the application.
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @param ceremony <FirebaseDocumentInfo> - the Firestore document of the ceremony.
 * @param circuit <FirebaseDocumentInfo> - the Firestore document of the ceremony circuit.
 * @param participant <FirebaseDocumentInfo> - the Firestore document of the participant (coordinator).
 * @param beaconHash <string> - the beacon hash used to finalize the contribution.
 * @param coordinatorIdentifier <string> - the identifier of the coordinator.
 */
const handleCircuitFinalization = async (
    cloudFunctions: Functions,
    firestoreDatabase: Firestore,
    ceremony: FirebaseDocumentInfo,
    circuit: FirebaseDocumentInfo,
    participant: FirebaseDocumentInfo,
    beaconHash: string,
    coordinatorIdentifier: string
) => {
    // Step (1).
    await handleStartOrResumeContribution(
        cloudFunctions,
        firestoreDatabase,
        ceremony,
        circuit,
        participant,
        beaconHash,
        coordinatorIdentifier,
        true
    )

    await sleep(2000) // workaound for descriptors.

    // Extract data.
    const { prefix: circuitPrefix } = circuit.data
    const { prefix: ceremonyPrefix } = ceremony.data

    // Prepare local paths.
    const finalZkeyLocalFilePath = getFinalZkeyLocalFilePath(`${circuitPrefix}_${finalContributionIndex}.zkey`)
    const verificationKeyLocalFilePath = getVerificationKeyLocalFilePath(
        `${circuitPrefix}_${verificationKeyAcronym}.json`
    )
    const verifierContractLocalFilePath = getVerifierContractLocalFilePath(
        `${circuitPrefix}_${verifierSmartContractAcronym}.sol`
    )

    // Prepare storage paths.
    const verificationKeyStorageFilePath = getVerificationKeyStorageFilePath(
        circuitPrefix,
        `${circuitPrefix}_${verificationKeyAcronym}.json`
    )
    const verifierContractStorageFilePath = getVerifierContractStorageFilePath(
        circuitPrefix,
        `${circuitPrefix}_${verifierSmartContractAcronym}.sol`
    )

    // Get ceremony bucket.
    const bucketName = getBucketName(ceremonyPrefix, String(process.env.CONFIG_CEREMONY_BUCKET_POSTFIX))

    // Step (2 & 4).
    await handleVerificationKey(
        cloudFunctions,
        bucketName,
        finalZkeyLocalFilePath,
        verificationKeyLocalFilePath,
        verificationKeyStorageFilePath
    )

    // Step (3 & 4).
    await handleVerifierSmartContract(
        cloudFunctions,
        bucketName,
        finalZkeyLocalFilePath,
        verifierContractLocalFilePath,
        verifierContractStorageFilePath
    )

    // Step (5).
    const spinner = customSpinner(`Wrapping up the finalization of the circuit...`, `clock`)
    spinner.start()

    // Finalize circuit contribution.
    await finalizeCircuit(cloudFunctions, ceremony.id, circuit.id, bucketName)

    await sleep(2000)

    spinner.succeed(`Circuit has been finalized correctly`)
}

/**
 * Finalize command.
 * @notice The finalize command allows a coordinator to finalize a Trusted Setup Phase 2 ceremony by providing the final beacon,
 * computing the final zKeys and extracting the Verifier Smart Contract + Verification Keys per each ceremony circuit.
 * anyone could use the final zKey to create a proof and everyone else could verify the correctness using the
 * related verification key (off-chain) or Verifier smart contract (on-chain).
 * @dev For proper execution, the command requires the coordinator to be authenticated with a GitHub account (run auth command first) in order to
 * handle sybil-resistance and connect to GitHub APIs to publish the gist containing the final public attestation.
 */
const finalize = async () => {
    const { firebaseApp, firebaseFunctions, firestoreDatabase } = await bootstrapCommandExecutionAndServices()

    // Check for authentication.
    const { user, handle, token: coordinatorAccessToken } = await checkAuth(firebaseApp)

    // Preserve command execution only for coordinators.
    if (!(await isCoordinator(user))) showError(COMMAND_ERRORS.COMMAND_NOT_COORDINATOR, true)

    // Retrieve the closed ceremonies (ready for finalization).
    const ceremoniesClosedForFinalization = await getClosedCeremonies(firestoreDatabase)

    // Gracefully exit if no ceremonies are closed and ready for finalization.
    if (!ceremoniesClosedForFinalization.length) showError(COMMAND_ERRORS.COMMAND_FINALIZED_NO_CLOSED_CEREMONIES, true)

    console.log(
        `${theme.symbols.warning} The computation of the final contribution could take the bulk of your computational resources and memory based on the size of the circuit ${theme.emojis.fire}\n`
    )

    // Prompt for ceremony selection.
    const selectedCeremony = await promptForCeremonySelection(ceremoniesClosedForFinalization, true)

    // Get coordinator participant document.
    let participant = await getDocumentById(
        firestoreDatabase,
        getParticipantsCollectionPath(selectedCeremony.id),
        user.uid
    )

    const isCoordinatorReadyForCeremonyFinalization = await checkAndPrepareCoordinatorForFinalization(
        firebaseFunctions,
        selectedCeremony.id
    )

    if (!isCoordinatorReadyForCeremonyFinalization)
        showError(COMMAND_ERRORS.COMMAND_FINALIZED_NOT_READY_FOR_FINALIZATION, true)

    // Prompt for beacon.
    const beacon = await promptToTypeEntropyOrBeacon(false)
    // Compute hash
    const beaconHash = computeSHA256ToHex(beacon)
    // Display.
    console.log(`${theme.symbols.info} Beacon SHA256 hash ${theme.text.bold(beaconHash)}`)

    // Clean directories.
    checkAndMakeNewDirectoryIfNonexistent(localPaths.output)
    checkAndMakeNewDirectoryIfNonexistent(localPaths.finalize)
    checkAndMakeNewDirectoryIfNonexistent(localPaths.finalZkeys)
    checkAndMakeNewDirectoryIfNonexistent(localPaths.finalPot)
    checkAndMakeNewDirectoryIfNonexistent(localPaths.finalAttestations)
    checkAndMakeNewDirectoryIfNonexistent(localPaths.verificationKeys)
    checkAndMakeNewDirectoryIfNonexistent(localPaths.verifierContracts)

    // Get ceremony circuits.
    const circuits = await getCeremonyCircuits(firestoreDatabase, selectedCeremony.id)

    // Handle finalization for each ceremony circuit.
    for await (const circuit of circuits)
        await handleCircuitFinalization(
            firebaseFunctions,
            firestoreDatabase,
            selectedCeremony,
            circuit,
            participant,
            beaconHash,
            handle
        )

    process.stdout.write(`\n`)

    const spinner = customSpinner(`Wrapping up the finalization of the ceremony...`, "clock")
    spinner.start()

    // Finalize the ceremony.
    await finalizeCeremony(firebaseFunctions, selectedCeremony.id)

    spinner.succeed(
        `Great, you have completed the finalization of the ${theme.text.bold(selectedCeremony.data.title)} ceremony ${
            theme.emojis.tada
        }\n`
    )

    // Get updated coordinator participant document.
    participant = await getDocumentById(firestoreDatabase, getParticipantsCollectionPath(selectedCeremony.id), user.uid)

    // Extract updated data.
    const { contributions } = participant.data()!
    const { prefix, title: ceremonyName } = selectedCeremony.data

    // Generate attestation with final contributions.
    const publicAttestation = await generateValidContributionsAttestation(
        firestoreDatabase,
        circuits,
        selectedCeremony.id,
        participant.id,
        contributions,
        handle,
        ceremonyName,
        true
    )

    // Write public attestation locally.
    writeFile(
        getAttestationLocalFilePath(
            `${prefix}_${finalContributionIndex}_${commonTerms.foldersAndPathsTerms.attestation}.log`
        ),
        Buffer.from(publicAttestation)
    )

    await sleep(3000) // workaround for file descriptor unexpected close.

    /// @todo mandatory 'gist' permissions or not?.
    const gistUrl = await publishGist(coordinatorAccessToken, publicAttestation, ceremonyName, prefix)

    console.log(
        `\n${
            theme.symbols.info
        } Your public final attestation has been successfully posted as Github Gist (${theme.text.bold(
            theme.text.underlined(gistUrl)
        )})`
    )

    // Generate a ready to share custom url to tweet about ceremony participation.
    const tweetUrl = generateCustomUrlToTweetAboutParticipation(ceremonyName, gistUrl, true)

    console.log(
        `${
            theme.symbols.info
        } We encourage you to tweet about the ceremony finalization by clicking the link below\n\n${theme.text.underlined(
            tweetUrl
        )}`
    )

    // Automatically open a webpage with the tweet.
    await open(tweetUrl)

    terminate(handle)
}

export default finalize
