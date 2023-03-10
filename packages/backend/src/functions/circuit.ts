import * as functionsV1 from "firebase-functions/v1"
import * as functionsV2 from "firebase-functions/v2"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { QueryDocumentSnapshot } from "firebase-functions/v1/firestore"
import { Change } from "firebase-functions"
import { zKey } from "snarkjs"
import fs from "fs"
import { Timer } from "timer-node"
import { FieldValue } from "firebase-admin/firestore"
import {
    blake512FromPath,
    commonTerms,
    getParticipantsCollectionPath,
    getCircuitsCollectionPath,
    getPotStorageFilePath,
    getZkeyStorageFilePath,
    getContributionsCollectionPath,
    genesisZkeyIndex,
    formatZkeyIndex,
    getTranscriptStorageFilePath,
    getVerificationKeyStorageFilePath,
    getVerifierContractStorageFilePath,
    createCustomLoggerForFile,
    finalContributionIndex,
    verificationKeyAcronym,
    verifierSmartContractAcronym,
    computeSHA256ToHex
} from "@zkmpc/actions/src"
import { ParticipantStatus, ParticipantContributionStep, CeremonyState } from "@zkmpc/actions/src/types/enums"
import { FinalizeCircuitData, VerifyContributionData } from "types"
import { Contribution } from "@zkmpc/actions/src/types"
import { LogLevel } from "../../types/enums"
import { COMMON_ERRORS, logAndThrowError, printLog, SPECIFIC_ERRORS } from "../lib/errors"
import {
    createTemporaryLocalPath,
    deleteObject,
    downloadArtifactFromS3Bucket,
    getCeremonyCircuits,
    getCircuitDocumentByPosition,
    getCurrentServerTimestampInMillis,
    getDocumentById,
    getFinalContribution,
    sleep,
    uploadFileToBucket
} from "../lib/utils"

dotenv.config()

/**
 * Execute the coordination of the participant for the given circuit.
 * @dev possible coordination scenarios:
 * A) The participant becomes the current contributor of circuit X (single participant).
 * B) The participant is placed in the contribution waiting queue because someone else is currently contributing to circuit X (single participant)
 * C) The participant is removed as current contributor from Circuit X and gets coordinated for Circuit X + 1 (multi-participant).
 *    C.1) The first participant in the waiting queue for Circuit X (if any), becomes the new contributor for circuit X.
 * @param participant <QueryDocumentSnapshot> - the Firestore document of the participant.
 * @param circuit <QueryDocumentSnapshot> - the Firestore document of the circuit.
 * @param isSingleParticipantCoordination <boolean> - true if the coordination involves only a single participant; otherwise false (= involves multiple participant).
 * @param [ceremonyId] <string> - the unique identifier of the ceremony (needed only for multi-participant coordination).
 */
const coordinate = async (
    participant: QueryDocumentSnapshot,
    circuit: QueryDocumentSnapshot,
    isSingleParticipantCoordination: boolean,
    ceremonyId?: string
) => {
    // Prepare db and transactions batch.
    const firestore = admin.firestore()
    const batch = firestore.batch()

    // Extract data.
    const { status, contributionStep } = participant.data()
    const { waitingQueue } = circuit.data()
    const { contributors, currentContributor } = waitingQueue

    // Prepare state updates for waiting queue.
    const newContributors: Array<string> = contributors
    let newCurrentContributorId: string = ""

    // Prepare state updates for participant.
    let newParticipantStatus: string = ""
    let newContributionStep: string = ""

    // Prepare pre-conditions.
    const noCurrentContributor = !currentContributor
    const noContributorsInWaitingQueue = !contributors.length
    const emptyWaitingQueue = noCurrentContributor && noContributorsInWaitingQueue

    const participantIsNotCurrentContributor = currentContributor !== participant.id
    const participantIsCurrentContributor = currentContributor === participant.id
    const participantIsReady = status === ParticipantStatus.READY
    const participantResumingAfterTimeoutExpiration = participantIsCurrentContributor && participantIsReady

    const participantCompletedOneOrAllContributions =
        (status === ParticipantStatus.CONTRIBUTED || status === ParticipantStatus.DONE) &&
        contributionStep === ParticipantContributionStep.COMPLETED

    // Check for scenarios.
    if (isSingleParticipantCoordination) {
        // Scenario (A).
        if (emptyWaitingQueue) {
            printLog(`Coordinate - executing scenario A - emptyWaitingQueue`, LogLevel.DEBUG)

            // Update.
            newCurrentContributorId = participant.id
            newParticipantStatus = ParticipantStatus.CONTRIBUTING
            newContributionStep = ParticipantContributionStep.DOWNLOADING
            newContributors.push(newCurrentContributorId)
        }
        // Scenario (A).
        else if (participantResumingAfterTimeoutExpiration) {
            printLog(
                `Coordinate - executing scenario A - single - participantResumingAfterTimeoutExpiration`,
                LogLevel.DEBUG
            )

            newParticipantStatus = ParticipantStatus.CONTRIBUTING
            newContributionStep = ParticipantContributionStep.DOWNLOADING
        }
        // Scenario (B).
        else if (participantIsNotCurrentContributor) {
            printLog(`Coordinate - executing scenario B - single - participantIsNotCurrentContributor`, LogLevel.DEBUG)

            newParticipantStatus = ParticipantStatus.WAITING
            newContributors.push(participant.id)
        }

        // Prepare tx - Scenario (A) only.
        if (newContributionStep)
            batch.update(participant.ref, {
                contributionStep: newContributionStep,
                lastUpdated: getCurrentServerTimestampInMillis()
            })

        // Prepare tx - Scenario (A) or (B).
        batch.update(participant.ref, {
            status: newParticipantStatus,
            contributionStartedAt:
                newParticipantStatus === ParticipantStatus.CONTRIBUTING ? getCurrentServerTimestampInMillis() : 0,
            lastUpdated: getCurrentServerTimestampInMillis()
        })
    } else if (participantIsCurrentContributor && participantCompletedOneOrAllContributions && !!ceremonyId) {
        printLog(
            `Coordinate - executing scenario C - multi - participantIsCurrentContributor && participantCompletedOneOrAllContributions`,
            LogLevel.DEBUG
        )

        // Remove from waiting queue of circuit X.
        newContributors.shift()

        // Step (C.1).
        if (newContributors.length > 0) {
            // Get new contributor for circuit X.
            newCurrentContributorId = newContributors.at(0)!

            // Pass the baton to the new contributor.
            const newCurrentContributorDocument = await getDocumentById(
                getParticipantsCollectionPath(ceremonyId),
                newCurrentContributorId
            )

            // Prepare update tx.
            batch.update(newCurrentContributorDocument.ref, {
                status: ParticipantStatus.WAITING, // need to be refreshed.
                lastUpdated: getCurrentServerTimestampInMillis()
            })

            printLog(
                `Participant ${newCurrentContributorId} is the new current contributor for circuit ${circuit.id}`,
                LogLevel.DEBUG
            )
        }
    }

    // Prepare tx - must be done for all Scenarios.
    batch.update(circuit.ref, {
        waitingQueue: {
            ...waitingQueue,
            contributors: newContributors,
            currentContributor: newCurrentContributorId
        },
        lastUpdated: getCurrentServerTimestampInMillis()
    })

    // Send txs.
    await batch.commit()

    printLog(`Coordinate successfully completed`, LogLevel.DEBUG)
}

/**
 * This method is used to coordinate the waiting queues of ceremony circuits.
 * @dev this cloud function is triggered whenever an update of a document related to a participant of a ceremony occurs.
 * The function verifies that such update is preparatory towards a waiting queue update for one or more circuits in the ceremony.
 * If that's the case, this cloud functions proceeds with the "coordination" of the waiting queues, leading to three different scenarios:
 * A) The participant becomes the current contributor of circuit X (single participant).
 * B) The participant is placed in the contribution waiting queue because someone else is currently contributing to circuit X (single participant)
 * C) The participant is removed as current contributor from Circuit X and gets coordinated for Circuit X + 1 (multi-participant).
 *    C.1) The first participant in the waiting queue for Circuit X (if any), becomes the new contributor for circuit X.
 * Before triggering the above scenarios, the cloud functions verifies that suitable pre-conditions are met.
 * @notice The cloud function performs the subsequent steps:
 * 0) Prepares the participant's previous and current data (after/before document change).
 * 1) Retrieve the ceremony from the participant's document path.
 * 2) Verifies that the participant has changed to a state for which it is ready for contribution.
 * 2.A) If ready, verifies whether the participant is ready to:
 * - Contribute for the first time or for the next circuit (other than the first) or contribute after a timeout has expired. If yes, coordinate (single participant scenario).
 * 2.B) Otherwise, check whether the participant has:
 * - Just completed a contribution or all contributions for each circuit. If yes, coordinate (multi-participant scenario).
 */
export const coordinateCeremonyParticipant = functionsV1.firestore
    .document(
        `${commonTerms.collections.ceremonies.name}/{ceremonyId}/${commonTerms.collections.participants.name}/{participantId}`
    )
    .onUpdate(async (participantChanges: Change<QueryDocumentSnapshot>) => {
        // Step (0).
        const exParticipant = participantChanges.before
        const changedParticipant = participantChanges.after

        if (!exParticipant.data() || !changedParticipant.data())
            logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

        // Step (1).
        const ceremonyId = exParticipant.ref.parent.parent!.path.replace(
            `${commonTerms.collections.ceremonies.name}/`,
            ""
        )

        if (!ceremonyId) logAndThrowError(COMMON_ERRORS.CM_INVALID_CEREMONY_FOR_PARTICIPANT)

        // Extract data.
        const {
            contributionProgress: prevContributionProgress,
            status: prevStatus,
            contributionStep: prevContributionStep
        } = exParticipant.data()!

        const {
            contributionProgress: changedContributionProgress,
            status: changedStatus,
            contributionStep: changedContributionStep
        } = changedParticipant.data()!

        printLog(`Coordinate participant ${exParticipant.id} for ceremony ${ceremonyId}`, LogLevel.DEBUG)
        printLog(
            `Participant status: ${prevStatus} => ${changedStatus} - Participant contribution step: ${prevContributionStep} => ${changedContributionStep}`,
            LogLevel.DEBUG
        )

        // Define pre-conditions.
        const participantReadyToContribute = changedStatus === ParticipantStatus.READY

        const participantReadyForFirstContribution = participantReadyToContribute && prevContributionProgress === 0

        const participantResumingContributionAfterTimeout =
            participantReadyToContribute && prevContributionProgress === changedContributionProgress

        const participantReadyForNextContribution =
            participantReadyToContribute &&
            prevContributionProgress === changedContributionProgress - 1 &&
            prevContributionProgress !== 0

        const participantCompletedEveryCircuitContribution =
            changedStatus === ParticipantStatus.DONE && prevStatus !== ParticipantStatus.DONE

        const participantCompletedContribution =
            prevContributionProgress === changedContributionProgress &&
            prevStatus === ParticipantStatus.CONTRIBUTING &&
            prevContributionStep === ParticipantContributionStep.VERIFYING &&
            changedStatus === ParticipantStatus.CONTRIBUTED &&
            changedContributionStep === ParticipantContributionStep.COMPLETED

        // Step (2).
        if (
            participantReadyForFirstContribution ||
            participantResumingContributionAfterTimeout ||
            participantReadyForNextContribution
        ) {
            // Step (2.A).
            printLog(
                `Participant is ready for first contribution (${participantReadyForFirstContribution}) or for the next contribution (${participantReadyForNextContribution}) or is resuming after a timeout expiration (${participantResumingContributionAfterTimeout})`,
                LogLevel.DEBUG
            )

            // Get the circuit.
            const circuit = await getCircuitDocumentByPosition(ceremonyId, changedContributionProgress)

            // Coordinate.
            await coordinate(changedParticipant, circuit, true)

            printLog(`Coordination for circuit ${circuit.id} completed`, LogLevel.DEBUG)
        } else if (participantCompletedContribution || participantCompletedEveryCircuitContribution) {
            // Step (2.B).
            printLog(
                `Participant completed a contribution (${participantCompletedContribution}) or every contribution for each circuit (${participantCompletedEveryCircuitContribution})`,
                LogLevel.DEBUG
            )

            // Get the circuit.
            const circuit = await getCircuitDocumentByPosition(ceremonyId, prevContributionProgress)

            // Coordinate.
            await coordinate(changedParticipant, circuit, false, ceremonyId)

            printLog(`Coordination for circuit ${circuit.id} completed`, LogLevel.DEBUG)
        }
    })

/**
 * Verify the contribution of a participant computed while contributing to a specific circuit of a ceremony.
 * @dev a huge amount of resources (memory, CPU, and execution time) is required for the contribution verification task.
 * For this reason, we are using a V2 Cloud Function (more memory, more CPU, and longer timeout).
 * Through the current configuration (16GiB memory and 4 vCPUs) we are able to support verification of contributions for 3.8M constraints circuit size.
 * @todo check if scaling memory and CPU can support +3.8M.
 * @notice The cloud function performs the subsequent steps:
 * 0) Prepare documents and extract necessary data.
 * 1) Check if the participant is the current contributor to the circuit or is the ceremony coordinator
 * 1.A) If either condition is true:
 *   1.A.1) Prepare verification transcript logger, storage, and temporary paths.
 *   1.A.2) Download necessary AWS S3 ceremony bucket artifacts.
 *   1.A.3) Execute contribution verification.
 *   1.A.4) Check contribution validity:
 *   1.A.4.A) If valid:
 *     1.A.4.A.1) Upload verification transcript to AWS S3 storage.
 *     1.A.4.A.2) Creates a new valid contribution document on Firestore.
 *   1.A.4.B) If not valid:
 *     1.A.4.B.1) Creates a new invalid contribution document on Firestore.
 *   1.A.4.C) Check if not finalizing:
 *       1.A.4.C.1) If true, update circuit waiting for queue and average timings accordingly to contribution verification results;
 * 2) Send all updates atomically to the Firestore database.
 * 3) Return verification results and time.
 */
export const verifycontribution = functionsV2.https.onCall(
    { memory: "16GiB", timeoutSeconds: 3600 },
    async (request: functionsV2.https.CallableRequest<VerifyContributionData>): Promise<any> => {
        if (!request.auth || (!request.auth.token.participant && !request.auth.token.coordinator))
            logAndThrowError(SPECIFIC_ERRORS.SE_AUTH_NO_CURRENT_AUTH_USER)

        if (
            !request.data.ceremonyId ||
            !request.data.circuitId ||
            !request.data.contributorOrCoordinatorIdentifier ||
            !request.data.bucketName
        )
            logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        if (
            !process.env.CUSTOM_CONTRIBUTION_VERIFICATION_SOFTWARE_NAME ||
            !process.env.CUSTOM_CONTRIBUTION_VERIFICATION_SOFTWARE_VERSION ||
            !process.env.CUSTOM_CONTRIBUTION_VERIFICATION_SOFTWARE_COMMIT_HASH
        )
            logAndThrowError(COMMON_ERRORS.CM_WRONG_CONFIGURATION)

        // Step (0).

        // Prepare and start timer.
        const verifyContributionTimer = new Timer({ label: commonTerms.cloudFunctionsNames.verifyContribution })
        verifyContributionTimer.start()

        // Get DB.
        const firestore = admin.firestore()
        // Prepare batch of txs.
        const batch = firestore.batch()

        // Extract data.
        const { ceremonyId, circuitId, contributorOrCoordinatorIdentifier, bucketName } = request.data
        const userId = request.auth?.uid

        // Look for the ceremony, circuit and participant document.
        const ceremonyDoc = await getDocumentById(commonTerms.collections.ceremonies.name, ceremonyId)
        const circuitDoc = await getDocumentById(getCircuitsCollectionPath(ceremonyId), circuitId)
        const participantDoc = await getDocumentById(getParticipantsCollectionPath(ceremonyId), userId!)

        if (!ceremonyDoc.data() || !circuitDoc.data() || !participantDoc.data())
            logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

        // Extract documents data.
        const { state } = ceremonyDoc.data()!
        const { status, contributions, verificationStartedAt, contributionStartedAt } = participantDoc.data()!
        const { waitingQueue, prefix, files, avgTimings } = circuitDoc.data()!
        const { completedContributions, failedContributions } = waitingQueue
        const {
            contributionComputation: avgContributionComputationTime,
            fullContribution: avgFullContributionTime,
            verifyCloudFunction: avgVerifyCloudFunctionTime
        } = avgTimings

        // Define pre-conditions.
        const isFinalizing = state === CeremonyState.CLOSED && request.auth && request.auth.token.coordinator // true only when the coordinator verifies the final contributions.
        const isContributing = status === ParticipantStatus.CONTRIBUTING

        // Prepare state.
        let isContributionValid = false
        let verifyCloudFunctionExecutionTime = 0 // time spent while executing the verify contribution cloud function.
        let verifyCloudFunctionTime = 0 // time spent while executing the core business logic of this cloud function.
        let fullContributionTime = 0 // time spent while doing non-verification contributions tasks (download, compute, upload).
        let contributionComputationTime = 0

        // Derive necessary data.
        const lastZkeyIndex = formatZkeyIndex(completedContributions + 1)
        const verificationTranscriptCompleteFilename = `${prefix}_${
            isFinalizing
                ? `${contributorOrCoordinatorIdentifier}_${finalContributionIndex}_verification_transcript.log`
                : `${lastZkeyIndex}_${contributorOrCoordinatorIdentifier}_verification_transcript.log`
        }`
        const firstZkeyFilename = `${prefix}_${genesisZkeyIndex}.zkey`
        const lastZkeyFilename = `${prefix}_${isFinalizing ? finalContributionIndex : lastZkeyIndex}.zkey`

        // Step (1).
        if (isContributing || isFinalizing) {
            // Step (1.A.1).
            // Get storage paths.
            const verificationTranscriptStoragePathAndFilename = getTranscriptStorageFilePath(
                prefix,
                verificationTranscriptCompleteFilename
            )
            const potStoragePath = getPotStorageFilePath(files.potFilename)
            const firstZkeyStoragePath = getZkeyStorageFilePath(prefix, `${prefix}_${genesisZkeyIndex}.zkey`)
            const lastZkeyStoragePath = getZkeyStorageFilePath(
                prefix,
                `${prefix}_${isFinalizing ? finalContributionIndex : lastZkeyIndex}.zkey`
            )

            // Prepare temporary file paths.
            // (nb. these are needed to download the necessary artifacts for verification from AWS S3).
            const verificationTranscriptTemporaryLocalPath = createTemporaryLocalPath(
                verificationTranscriptCompleteFilename
            )
            const potTempFilePath = createTemporaryLocalPath(files.potFilename)
            const firstZkeyTempFilePath = createTemporaryLocalPath(firstZkeyFilename)
            const lastZkeyTempFilePath = createTemporaryLocalPath(lastZkeyFilename)

            // Create and populate transcript.
            const transcriptLogger = createCustomLoggerForFile(verificationTranscriptTemporaryLocalPath)
            transcriptLogger.info(
                `${
                    isFinalizing ? `Final verification` : `Verification`
                } transcript for ${prefix} circuit Phase 2 contribution.\n${
                    isFinalizing ? `Coordinator ` : `Contributor # ${Number(lastZkeyIndex)}`
                } (${contributorOrCoordinatorIdentifier})\n`
            )

            // Step (1.A.2).
            await downloadArtifactFromS3Bucket(bucketName, potStoragePath, potTempFilePath)
            await downloadArtifactFromS3Bucket(bucketName, firstZkeyStoragePath, firstZkeyTempFilePath)
            await downloadArtifactFromS3Bucket(bucketName, lastZkeyStoragePath, lastZkeyTempFilePath)

            printLog(`Downloads from AWS S3 bucket completed - ceremony ${ceremonyId}`, LogLevel.DEBUG)

            // Prepare timer.
            const verificationTaskTimer = new Timer({ label: `${ceremonyId}-${circuitId}-${participantDoc.id}` })
            verificationTaskTimer.start()

            // Step (1.A.3).
            isContributionValid = await zKey.verifyFromInit(
                firstZkeyTempFilePath,
                potTempFilePath,
                lastZkeyTempFilePath,
                transcriptLogger
            )

            verificationTaskTimer.stop()
            verifyCloudFunctionExecutionTime = verificationTaskTimer.ms()

            printLog(`The contribution has been verified - Result ${isContributionValid}`, LogLevel.DEBUG)

            // Compute contribution hash.
            const lastZkeyBlake2bHash = await blake512FromPath(lastZkeyTempFilePath)

            // Free resources by unlinking temporary folders.
            // Do not free-up verification transcript path here.
            fs.unlinkSync(potTempFilePath)
            fs.unlinkSync(firstZkeyTempFilePath)
            fs.unlinkSync(lastZkeyTempFilePath)

            // Create a new contribution document.
            const contributionDoc = await firestore
                .collection(getContributionsCollectionPath(ceremonyId, circuitId))
                .doc()
                .get()

            // Step (1.A.4).
            if (isContributionValid) {
                // Sleep ~3 seconds to wait for verification transcription.
                await sleep(3000)

                // Step (1.A.4.A.1).

                /// nb. do not use multi-part upload here due to small file size.
                await uploadFileToBucket(
                    bucketName,
                    verificationTranscriptStoragePathAndFilename,
                    verificationTranscriptTemporaryLocalPath
                )

                // Compute verification transcript hash.
                const transcriptBlake2bHash = await blake512FromPath(verificationTranscriptTemporaryLocalPath)

                // Free resources by unlinking transcript temporary folder.
                fs.unlinkSync(verificationTranscriptTemporaryLocalPath)

                // Filter participant contributions to find the data related to the one verified.
                const participantContributions = contributions.filter(
                    (contribution: Contribution) =>
                        !!contribution.hash && !!contribution.computationTime && !contribution.doc
                )

                /// @dev (there must be only one contribution with an empty 'doc' field).
                if (participantContributions.length !== 1)
                    logAndThrowError(SPECIFIC_ERRORS.SE_VERIFICATION_NO_PARTICIPANT_CONTRIBUTION_DATA)

                // Get contribution computation time.
                contributionComputationTime = contributions.at(0).computationTime

                // Step (1.A.4.A.2).
                batch.create(contributionDoc.ref, {
                    participantId: participantDoc.id,
                    contributionComputationTime,
                    verificationComputationTime: verifyCloudFunctionExecutionTime,
                    zkeyIndex: isFinalizing ? finalContributionIndex : lastZkeyIndex,
                    files: {
                        transcriptFilename: verificationTranscriptCompleteFilename,
                        lastZkeyFilename,
                        transcriptStoragePath: verificationTranscriptStoragePathAndFilename,
                        lastZkeyStoragePath,
                        transcriptBlake2bHash,
                        lastZkeyBlake2bHash
                    },
                    verificationSoftware: {
                        name: String(process.env.CUSTOM_CONTRIBUTION_VERIFICATION_SOFTWARE_NAME),
                        version: String(process.env.CUSTOM_CONTRIBUTION_VERIFICATION_SOFTWARE_VERSION),
                        commitHash: String(process.env.CUSTOM_CONTRIBUTION_VERIFICATION_SOFTWARE_COMMIT_HASH)
                    },
                    valid: isContributionValid,
                    lastUpdated: getCurrentServerTimestampInMillis()
                })

                verifyContributionTimer.stop()
                verifyCloudFunctionTime = verifyContributionTimer.ms()
            } else {
                // Step (1.A.4.B).

                // Free-up storage by deleting invalid contribution.
                await deleteObject(bucketName, lastZkeyStoragePath)

                // Free resources by unlinking verification transcript.
                fs.unlinkSync(verificationTranscriptTemporaryLocalPath)

                // Step (1.A.4.B.1).
                batch.create(contributionDoc.ref, {
                    participantId: participantDoc.id,
                    verificationComputationTime: verifyCloudFunctionExecutionTime,
                    zkeyIndex: isFinalizing ? finalContributionIndex : lastZkeyIndex,
                    verificationSoftware: {
                        name: String(process.env.CUSTOM_CONTRIBUTION_VERIFICATION_SOFTWARE_NAME),
                        version: String(process.env.CUSTOM_CONTRIBUTION_VERIFICATION_SOFTWARE_VERSION),
                        commitHash: String(process.env.CUSTOM_CONTRIBUTION_VERIFICATION_SOFTWARE_COMMIT_HASH)
                    },
                    valid: isContributionValid,
                    lastUpdated: getCurrentServerTimestampInMillis()
                })
            }

            // Step (1.A.4.C)
            if (!isFinalizing) {
                // Step (1.A.4.C.1)
                // Compute new average contribution/verification time.
                fullContributionTime = Number(verificationStartedAt) - Number(contributionStartedAt)

                const newAvgContributionComputationTime =
                    avgContributionComputationTime > 0
                        ? (avgContributionComputationTime + contributionComputationTime) / 2
                        : contributionComputationTime
                const newAvgFullContributionTime =
                    avgFullContributionTime > 0
                        ? (avgFullContributionTime + fullContributionTime) / 2
                        : fullContributionTime
                const newAvgVerifyCloudFunctionTime =
                    avgVerifyCloudFunctionTime > 0
                        ? (avgVerifyCloudFunctionTime + verifyCloudFunctionTime) / 2
                        : verifyCloudFunctionTime

                // Prepare tx to update circuit average contribution/verification time.
                /// @dev this must happen only for valid contributions.
                batch.update(circuitDoc.ref, {
                    avgTimings: {
                        contributionComputation: isContributionValid
                            ? newAvgContributionComputationTime
                            : avgContributionComputationTime,
                        fullContribution: isContributionValid ? newAvgFullContributionTime : avgFullContributionTime,
                        verifyCloudFunction: isContributionValid
                            ? newAvgVerifyCloudFunctionTime
                            : avgVerifyCloudFunctionTime
                    },
                    waitingQueue: {
                        ...waitingQueue,
                        completedContributions: isContributionValid
                            ? completedContributions + 1
                            : completedContributions,
                        failedContributions: isContributionValid ? failedContributions : failedContributions + 1
                    },
                    lastUpdated: getCurrentServerTimestampInMillis()
                })
            }
        }

        // Step (2).
        await batch.commit()

        printLog(
            `The contribution #${lastZkeyIndex} of circuit ${circuitId} (ceremony ${ceremonyId}) has been verified as ${
                isContributionValid ? "valid" : "invalid"
            } for the participant ${participantDoc.id}`,
            LogLevel.DEBUG
        )

        // Step (3).
        return {
            valid: isContributionValid,
            fullContributionTime,
            verifyCloudFunctionTime
        }
    }
)

/**
 * Update the related participant's document after verification of its last contribution.
 * @dev this cloud functions is responsible for preparing the participant for the contribution toward the next circuit.
 * this does not happen if the participant is actually the coordinator who is finalizing the ceremony.
 */
export const refreshParticipantAfterContributionVerification = functionsV1.firestore
    .document(
        `/${commonTerms.collections.ceremonies.name}/{ceremony}/${commonTerms.collections.circuits.name}/{circuit}/${commonTerms.collections.contributions.name}/{contributions}`
    )
    .onCreate(async (createdContribution: QueryDocumentSnapshot) => {
        // Prepare db.
        const firestore = admin.firestore()
        // Prepare batch of txs.
        const batch = firestore.batch()

        // Derive data from document.
        // == /ceremonies/{ceremony}/circuits/.
        const ceremonyId = createdContribution.ref.parent.parent?.parent?.parent?.path.replace(
            `${commonTerms.collections.ceremonies.name}/`,
            ""
        )!
        // == /ceremonies/{ceremony}/participants.
        const ceremonyParticipantsCollectionPath =
            `${createdContribution.ref.parent.parent?.parent?.parent?.path}/${commonTerms.collections.participants.name}`!

        if (!createdContribution.data()) logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

        // Extract data.
        const { participantId } = createdContribution.data()!

        // Get documents from derived paths.
        const circuits = await getCeremonyCircuits(ceremonyId)
        const participantDoc = await getDocumentById(ceremonyParticipantsCollectionPath, participantId)

        if (!participantDoc.data()) logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

        // Extract data.
        const { contributions, status, contributionProgress } = participantDoc.data()!

        // Define pre-conditions.
        const isFinalizing = status === ParticipantStatus.FINALIZING

        // Link the newest created contribution document w/ participant contributions info.
        // nb. there must be only one contribution with an empty doc.
        contributions.forEach((participantContribution: Contribution) => {
            // Define pre-conditions.
            const isContributionWithoutDocRef =
                !!participantContribution.hash &&
                !!participantContribution.computationTime &&
                !participantContribution.doc

            if (isContributionWithoutDocRef) participantContribution.doc = createdContribution.id
        })

        // Check if the participant is not the coordinator trying to finalize the ceremony.
        if (!isFinalizing)
            batch.update(participantDoc.ref, {
                // - DONE = provided a contribution for every circuit
                // - CONTRIBUTED = some contribution still missing.
                status:
                    contributionProgress + 1 > circuits.length ? ParticipantStatus.DONE : ParticipantStatus.CONTRIBUTED,
                contributionStep: ParticipantContributionStep.COMPLETED,
                tempContributionData: FieldValue.delete()
            })

        // nb. valid both for participant or coordinator (finalizing).
        batch.update(participantDoc.ref, {
            contributions,
            lastUpdated: getCurrentServerTimestampInMillis()
        })

        await batch.commit()

        printLog(
            `Participant ${participantId} refreshed after contribution ${createdContribution.id} - The participant was finalizing the ceremony ${isFinalizing}`,
            LogLevel.DEBUG
        )
    })

/**
 * Finalize the ceremony circuit.
 * @dev this cloud function stores the hashes and storage references of the Verifier smart contract
 * and verification key extracted from the circuit final contribution (as part of the ceremony finalization process).
 */
export const finalizeCircuit = functionsV1.https.onCall(
    async (data: FinalizeCircuitData, context: functionsV1.https.CallableContext) => {
        if (!context.auth || !context.auth.token.coordinator) logAndThrowError(COMMON_ERRORS.CM_NOT_COORDINATOR_ROLE)

        if (!data.ceremonyId || !data.circuitId || !data.bucketName || !data.beacon)
            logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Get data.
        const { ceremonyId, circuitId, bucketName, beacon } = data
        const userId = context.auth?.uid

        // Look for documents.
        const ceremonyDoc = await getDocumentById(commonTerms.collections.ceremonies.name, ceremonyId)
        const participantDoc = await getDocumentById(getParticipantsCollectionPath(ceremonyId), userId!)
        const circuitDoc = await getDocumentById(getCircuitsCollectionPath(ceremonyId), circuitId)
        const contributionDoc = await getFinalContribution(ceremonyId, circuitId)

        if (!ceremonyDoc.data() || !circuitDoc.data() || !participantDoc.data() || !contributionDoc.data())
            logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

        // Extract data.
        const { prefix: circuitPrefix } = circuitDoc.data()!
        const { files } = contributionDoc.data()!

        // Prepare filenames and storage paths.
        const verificationKeyFilename = `${circuitPrefix}_${verificationKeyAcronym}.json`
        const verifierContractFilename = `${circuitPrefix}_${verifierSmartContractAcronym}.sol`
        const verificationKeyStorageFilePath = getVerificationKeyStorageFilePath(circuitPrefix, verificationKeyFilename)
        const verifierContractStorageFilePath = getVerifierContractStorageFilePath(
            circuitPrefix,
            verifierContractFilename
        )

        // Prepare temporary paths.
        const verificationKeyTemporaryFilePath = createTemporaryLocalPath(verificationKeyFilename)
        const verifierContractTemporaryFilePath = createTemporaryLocalPath(verifierContractFilename)

        // Download artifact from ceremony bucket.
        await downloadArtifactFromS3Bucket(bucketName, verificationKeyStorageFilePath, verificationKeyTemporaryFilePath)
        await downloadArtifactFromS3Bucket(
            bucketName,
            verifierContractStorageFilePath,
            verifierContractTemporaryFilePath
        )

        // Compute hash before unlink.
        const verificationKeyBlake2bHash = await blake512FromPath(verificationKeyTemporaryFilePath)
        const verifierContractBlake2bHash = await blake512FromPath(verifierContractTemporaryFilePath)

        // Free resources by unlinking temporary folders.
        fs.unlinkSync(verificationKeyTemporaryFilePath)
        fs.unlinkSync(verifierContractTemporaryFilePath)

        // Add references and hashes of the final contribution artifacts.
        await contributionDoc.ref.update({
            files: {
                ...files,
                verificationKeyBlake2bHash,
                verificationKeyFilename,
                verificationKeyStoragePath: verificationKeyStorageFilePath,
                verifierContractBlake2bHash,
                verifierContractFilename,
                verifierContractStoragePath: verifierContractStorageFilePath
            },
            beacon: {
                value: beacon,
                hash: computeSHA256ToHex(beacon)
            }
        })

        printLog(
            `Circuit ${circuitId} finalization completed - Ceremony ${ceremonyDoc.id} - Coordinator ${participantDoc.id}`,
            LogLevel.DEBUG
        )
    }
)
