import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { commonTerms, getParticipantsCollectionPath } from "@zkmpc/actions/src"
import { CeremonyState, ParticipantStatus, ParticipantContributionStep } from "@zkmpc/actions/src/types/enums"
import { ParticipantDocument } from "@zkmpc/actions/src/types"
import {
    PermanentlyStoreCurrentContributionTimeAndHash,
    TemporaryStoreCurrentContributionMultiPartUploadId,
    TemporaryStoreCurrentContributionUploadedChunkData
} from "types"
import {
    getCeremonyCircuits,
    getCurrentServerTimestampInMillis,
    getDocumentById,
    queryNotExpiredTimeouts
} from "../lib/utils"
import { COMMON_ERRORS, logAndThrowError, printLog, SPECIFIC_ERRORS } from "../lib/errors"
import { LogLevel } from "../../types/enums"

dotenv.config()

/**
 * Check the user's current participant status for the ceremony.
 * @notice this cloud function has several tasks:
 * 1) Check if the authenticated user is a participant
 * 1.A) If not, register it has new participant for the ceremony.
 * 1.B) Otherwise:
 * 2.A) Check if already contributed to all circuits or,
 * 3.A) If already contributed, return false
 * 2.B) Check if it has a timeout in progress
 * 3.B) If timeout expired, allows the participant to resume the contribution.
 * 3.C) Otherwise, return false.
 * 1.D) If no timeout / participant already exist, just return true.
 * @dev true when the participant can participate (1.A, 3.B, 1.D); otherwise false.
 */
export const checkParticipantForCeremony = functions.https.onCall(
    async (data: { ceremonyId: string }, context: functions.https.CallableContext) => {
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            logAndThrowError(SPECIFIC_ERRORS.SE_AUTH_NO_CURRENT_AUTH_USER)

        if (!data.ceremonyId) logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Prepare Firestore DB.
        const firestore = admin.firestore()

        // Get data.
        const { ceremonyId } = data
        const userId = context.auth?.uid

        // Look for the ceremony document.
        const ceremonyDoc = await getDocumentById(commonTerms.collections.ceremonies.name, ceremonyId)

        // Extract data.
        const ceremonyData = ceremonyDoc.data()
        const { state } = ceremonyData!

        if (!ceremonyData) logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

        // Check pre-condition (ceremony state opened).
        if (state !== CeremonyState.OPENED) logAndThrowError(SPECIFIC_ERRORS.SE_PARTICIPANT_CEREMONY_NOT_OPENED)

        // Check (1).
        // nb. do not use `getDocumentById()` here as we need the falsy condition.
        const participantDoc = await firestore.collection(getParticipantsCollectionPath(ceremonyId)).doc(userId!).get()

        if (!participantDoc.exists) {
            // Action (1.A).
            const participantData: ParticipantDocument = {
                userId: participantDoc.id,
                status: ParticipantStatus.WAITING,
                contributionProgress: 0,
                contributionStartedAt: 0,
                contributions: [],
                lastUpdated: getCurrentServerTimestampInMillis()
            }

            // Register user as participant.
            await participantDoc.ref.set(participantData)

            printLog(
                `The user ${userId} has been registered as participant for ceremony ${ceremonyDoc.id}`,
                LogLevel.DEBUG
            )

            return true
        }
        // Check (1.B).

        // Extract data.
        const participantData = participantDoc.data()
        const { contributionProgress, status } = participantData!

        if (!participantData) logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

        // Get ceremony' circuits.
        const circuits = await getCeremonyCircuits(ceremonyDoc.id)

        // Check (2.A).
        if (contributionProgress === circuits.length && status === ParticipantStatus.DONE) {
            // Action (3.A).
            printLog(`Contributor ${participantDoc.id} has already contributed to all circuits`, LogLevel.DEBUG)

            return false
        }

        // Check (2.B).
        if (status === ParticipantStatus.TIMEDOUT) {
            // Query for not expired timeouts.
            const notExpiredTimeouts = await queryNotExpiredTimeouts(ceremonyDoc.id, participantDoc.id)

            if (notExpiredTimeouts.empty) {
                /// @todo unstable contributions, see issue #165.

                // Action (3.B).
                await participantDoc.ref.set(
                    {
                        status: ParticipantStatus.EXHUMED,
                        contributionStep: ParticipantContributionStep.DOWNLOADING,
                        lastUpdated: getCurrentServerTimestampInMillis()
                    },
                    { merge: true } // maintain same values for non explictly set fields.
                )

                printLog(`Timeout expired for participant ${participantDoc.id}`, LogLevel.DEBUG)

                return true
            }
            // Action (3.C).
            printLog(`Timeout still in effect for the participant ${participantDoc.id}`, LogLevel.DEBUG)

            return false
        }

        // Action (1.D).
        return true
    }
)

/**
 * Progress the participant to the next circuit preparing for the next contribution.
 * @dev The participant can progress if and only if:
 * 1) the participant has just been registered and is waiting to be queued for the first contribution (contributionProgress = 0 && status = WAITING).
 * 2) the participant has just finished the contribution for a circuit (contributionProgress != 0 && status = CONTRIBUTED && contributionStep = COMPLETED).
 */
export const progressToNextCircuitForContribution = functions.https.onCall(
    async (data: { ceremonyId: string }, context: functions.https.CallableContext): Promise<void> => {
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            logAndThrowError(SPECIFIC_ERRORS.SE_AUTH_NO_CURRENT_AUTH_USER)

        if (!data.ceremonyId) logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Get data.
        const { ceremonyId } = data
        const userId = context.auth?.uid

        // Look for the ceremony document.
        const ceremonyDoc = await getDocumentById(commonTerms.collections.ceremonies.name, ceremonyId)
        const participantDoc = await getDocumentById(getParticipantsCollectionPath(ceremonyId), userId!)

        // Prepare documents data.
        const participantData = participantDoc.data()

        if (!ceremonyDoc.data() || !participantData) logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

        // Extract data.
        const { contributionProgress, contributionStep, status } = participantData!

        // Define pre-conditions.
        const waitingToBeQueuedForFirstContribution = status === ParticipantStatus.WAITING && contributionProgress === 0
        const completedContribution =
            status === ParticipantStatus.CONTRIBUTED &&
            contributionStep === ParticipantContributionStep.COMPLETED &&
            contributionProgress !== 0

        // Check pre-conditions (1) or (2).
        if (completedContribution || waitingToBeQueuedForFirstContribution)
            await participantDoc.ref.update({
                contributionProgress: contributionProgress + 1,
                status: ParticipantStatus.READY,
                lastUpdated: getCurrentServerTimestampInMillis()
            })
        else logAndThrowError(SPECIFIC_ERRORS.SE_CONTRIBUTE_CANNOT_PROGRESS_TO_NEXT_CIRCUIT)

        printLog(
            `Participant/Contributor ${userId} progress to the circuit in position ${contributionProgress + 1}`,
            LogLevel.DEBUG
        )
    }
)

/**
 * Progress the participant to the next contribution step while contributing to a circuit.
 * @dev this cloud function must enforce the order among the contribution steps:
 * 1) Downloading the last contribution.
 * 2) Computing the next contribution.
 * 3) Uploading the next contribution.
 * 4) Requesting the verification to the cloud function `verifycontribution`.
 * 5) Completed contribution computation and verification.
 */
export const progressToNextContributionStep = functions.https.onCall(
    async (data: { ceremonyId: string }, context: functions.https.CallableContext) => {
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            logAndThrowError(SPECIFIC_ERRORS.SE_AUTH_NO_CURRENT_AUTH_USER)

        if (!data.ceremonyId) logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Get data.
        const { ceremonyId } = data
        const userId = context.auth?.uid

        // Look for the ceremony document.
        const ceremonyDoc = await getDocumentById(commonTerms.collections.ceremonies.name, ceremonyId)
        const participantDoc = await getDocumentById(getParticipantsCollectionPath(ceremonyDoc.id), userId!)

        if (!ceremonyDoc.data() || !participantDoc.data()) logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

        // Extract data.
        const { state } = ceremonyDoc.data()!
        const { status, contributionStep } = participantDoc.data()!

        // Pre-condition: ceremony must be opened.
        if (state !== CeremonyState.OPENED) logAndThrowError(SPECIFIC_ERRORS.SE_PARTICIPANT_CEREMONY_NOT_OPENED)

        // Pre-condition: participant has contributing status.
        if (status !== ParticipantStatus.CONTRIBUTING) logAndThrowError(SPECIFIC_ERRORS.SE_PARTICIPANT_NOT_CONTRIBUTING)

        // Prepare the next contribution step.
        let nextContributionStep = contributionStep

        if (contributionStep === ParticipantContributionStep.DOWNLOADING)
            nextContributionStep = ParticipantContributionStep.COMPUTING
        else if (contributionStep === ParticipantContributionStep.COMPUTING)
            nextContributionStep = ParticipantContributionStep.UPLOADING
        else if (contributionStep === ParticipantContributionStep.UPLOADING)
            nextContributionStep = ParticipantContributionStep.VERIFYING
        else if (contributionStep === ParticipantContributionStep.VERIFYING)
            nextContributionStep = ParticipantContributionStep.COMPLETED

        // Send tx.
        await participantDoc.ref.update({
            contributionStep: nextContributionStep,
            verificationStartedAt:
                nextContributionStep === ParticipantContributionStep.VERIFYING
                    ? getCurrentServerTimestampInMillis()
                    : 0,
            lastUpdated: getCurrentServerTimestampInMillis()
        })

        printLog(
            `Participant ${participantDoc.id} advanced to ${nextContributionStep} contribution step`,
            LogLevel.DEBUG
        )
    }
)

/**
 * Write the information about current contribution hash and computation time for the current contributor.
 * @dev enable the current contributor to resume a contribution from where it had left off.
 */
export const permanentlyStoreCurrentContributionTimeAndHash = functions.https.onCall(
    async (data: PermanentlyStoreCurrentContributionTimeAndHash, context: functions.https.CallableContext) => {
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            logAndThrowError(SPECIFIC_ERRORS.SE_AUTH_NO_CURRENT_AUTH_USER)

        if (!data.ceremonyId || !data.contributionHash || data.contributionComputationTime <= 0)
            logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Get data.
        const { ceremonyId } = data
        const userId = context.auth?.uid
        const isCoordinator = context?.auth?.token.coordinator

        // Look for the ceremony document.
        const ceremonyDoc = await getDocumentById(commonTerms.collections.ceremonies.name, ceremonyId)
        const participantDoc = await getDocumentById(getParticipantsCollectionPath(ceremonyDoc.id), userId!)

        if (!ceremonyDoc.data() || !participantDoc.data()) logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

        // Extract data.
        const { status, contributionStep, contributions: currentContributions } = participantDoc.data()!

        // Pre-condition: computing contribution step or finalizing (only for coordinator when finalizing ceremony).
        if (
            contributionStep === ParticipantContributionStep.COMPUTING ||
            (isCoordinator && status === ParticipantStatus.FINALIZING)
        )
            // Send tx.
            await participantDoc.ref.set(
                {
                    contributions: [
                        ...currentContributions,
                        {
                            hash: data.contributionHash,
                            computationTime: data.contributionComputationTime
                        }
                    ]
                },
                { merge: true }
            )
        else logAndThrowError(SPECIFIC_ERRORS.SE_PARTICIPANT_CANNOT_STORE_PERMANENT_DATA)

        printLog(
            `Participant ${participantDoc.id} has successfully stored the contribution hash ${data.contributionHash} and computation time ${data.contributionComputationTime}`,
            LogLevel.DEBUG
        )
    }
)

/**
 * Write temporary information about the unique identifier about the opened multi-part upload to eventually resume the contribution.
 * @dev enable the current contributor to resume a multi-part upload from where it had left off.
 */
export const temporaryStoreCurrentContributionMultiPartUploadId = functions.https.onCall(
    async (data: TemporaryStoreCurrentContributionMultiPartUploadId, context: functions.https.CallableContext) => {
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            logAndThrowError(SPECIFIC_ERRORS.SE_AUTH_NO_CURRENT_AUTH_USER)

        if (!data.ceremonyId || !data.uploadId) logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Get data.
        const { ceremonyId, uploadId } = data
        const userId = context.auth?.uid

        // Look for the ceremony document.
        const ceremonyDoc = await getDocumentById(commonTerms.collections.ceremonies.name, ceremonyId)
        const participantDoc = await getDocumentById(getParticipantsCollectionPath(ceremonyDoc.id), userId!)

        if (!ceremonyDoc.data() || !participantDoc.data()) logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

        // Extract data.
        const { contributionStep, tempContributionData: currentTempContributionData } = participantDoc.data()!

        // Pre-condition: check if the current contributor has uploading contribution step.
        if (contributionStep !== ParticipantContributionStep.UPLOADING)
            logAndThrowError(SPECIFIC_ERRORS.SE_PARTICIPANT_CANNOT_STORE_TEMPORARY_DATA)

        // Send tx.
        await participantDoc.ref.set(
            {
                tempContributionData: {
                    ...currentTempContributionData,
                    uploadId,
                    chunks: []
                },
                lastUpdated: getCurrentServerTimestampInMillis()
            },
            { merge: true }
        )

        printLog(
            `Participant ${participantDoc.id} has successfully stored the temporary data for ${uploadId} multi-part upload`,
            LogLevel.DEBUG
        )
    }
)

/**
 * Write temporary information about the etags and part numbers for each uploaded chunk in order to make the upload resumable from last chunk.
 * @dev enable the current contributor to resume a multi-part upload from where it had left off.
 */
export const temporaryStoreCurrentContributionUploadedChunkData = functions.https.onCall(
    async (data: TemporaryStoreCurrentContributionUploadedChunkData, context: functions.https.CallableContext) => {
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            logAndThrowError(SPECIFIC_ERRORS.SE_AUTH_NO_CURRENT_AUTH_USER)

        if (!data.ceremonyId || !data.chunk) logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Get data.
        const { ceremonyId, chunk } = data
        const userId = context.auth?.uid

        // Look for the ceremony document.
        const ceremonyDoc = await getDocumentById(commonTerms.collections.ceremonies.name, ceremonyId)
        const participantDoc = await getDocumentById(getParticipantsCollectionPath(ceremonyDoc.id), userId!)

        if (!ceremonyDoc.data() || !participantDoc.data()) logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

        // Extract data.
        const { contributionStep, tempContributionData: currentTempContributionData } = participantDoc.data()!

        // Pre-condition: check if the current contributor has uploading contribution step.
        if (contributionStep !== ParticipantContributionStep.UPLOADING)
            logAndThrowError(SPECIFIC_ERRORS.SE_PARTICIPANT_CANNOT_STORE_TEMPORARY_DATA)

        // Get already uploaded chunks.
        const chunks = currentTempContributionData.chunks ? currentTempContributionData.chunks : []

        // Push last chunk.
        chunks.push(chunk)

        // Update.
        await participantDoc.ref.set(
            {
                tempContributionData: {
                    ...currentTempContributionData,
                    chunks
                },
                lastUpdated: getCurrentServerTimestampInMillis()
            },
            { merge: true }
        )

        printLog(
            `Participant ${participantDoc.id} has successfully stored the temporary uploaded chunk data: ETag ${chunk.ETag} and PartNumber ${chunk.PartNumber}`,
            LogLevel.DEBUG
        )
    }
)

/**
 * Prepare the coordinator for the finalization of the ceremony.
 * @dev checks that the ceremony is closed (= CLOSED) and that the coordinator has already +
 * contributed to every selected ceremony circuits (= DONE).
 */
export const checkAndPrepareCoordinatorForFinalization = functions.https.onCall(
    async (data: { ceremonyId: string }, context: functions.https.CallableContext): Promise<boolean> => {
        if (!context.auth || !context.auth.token.coordinator) logAndThrowError(COMMON_ERRORS.CM_NOT_COORDINATOR_ROLE)

        if (!data.ceremonyId) logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Get data.
        const { ceremonyId } = data
        const userId = context.auth?.uid

        // Look for the ceremony document.
        const ceremonyDoc = await getDocumentById(commonTerms.collections.ceremonies.name, ceremonyId)
        const participantDoc = await getDocumentById(getParticipantsCollectionPath(ceremonyId), userId!)

        if (!ceremonyDoc.data() || !participantDoc.data()) logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

        // Get ceremony circuits.
        const circuits = await getCeremonyCircuits(ceremonyId)

        // Extract data.
        const { state } = ceremonyDoc.data()!
        const { contributionProgress, status } = participantDoc.data()!

        // Check pre-conditions.
        if (
            state === CeremonyState.CLOSED &&
            status === ParticipantStatus.DONE &&
            contributionProgress === circuits.length
        ) {
            // Make coordinator ready for finalization.
            await participantDoc.ref.set(
                {
                    status: ParticipantStatus.FINALIZING,
                    lastUpdated: getCurrentServerTimestampInMillis()
                },
                { merge: true }
            )

            printLog(
                `The coordinator ${participantDoc.id} is now ready to finalize the ceremony ${ceremonyId}.`,
                LogLevel.DEBUG
            )

            return true
        }
        printLog(
            `The coordinator ${participantDoc.id} is not ready to finalize the ceremony ${ceremonyId}.`,
            LogLevel.DEBUG
        )

        return false
    }
)
