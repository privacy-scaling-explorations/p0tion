import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { commonTerms, getCircuitsCollectionPath, getParticipantsCollectionPath } from "@zkmpc/actions/src"
import { CeremonyState, ParticipantStatus, ParticipantContributionStep } from "@zkmpc/actions/src/types/enums"
import { ParticipantDocument } from "@zkmpc/actions/src/types"
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
        if (state !== CeremonyState.OPENED) printLog(COMMON_ERRORS.GENERR_CEREMONY_NOT_OPENED, LogLevel.ERROR)

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

        // Check pre-conditions (1) or (2).
        if (
            (status === ParticipantStatus.CONTRIBUTED &&
                contributionStep === ParticipantContributionStep.COMPLETED &&
                contributionProgress !== 0) ||
            (status === ParticipantStatus.WAITING && contributionProgress === 0)
        )
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

/// @todo to be refactored.

/**
 * Progress to next contribution step for the current contributor of a specified circuit in a given ceremony.
 */
export const progressToNextContributionStep = functions.https.onCall(
    async (data: any, context: functions.https.CallableContext) => {
        // Check if sender is authenticated.
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            printLog(COMMON_ERRORS.GENERR_NO_AUTH_USER_FOUND, LogLevel.ERROR)

        if (!data.ceremonyId) printLog(COMMON_ERRORS.GENERR_NO_CEREMONY_PROVIDED, LogLevel.ERROR)

        // Get DB.
        const firestore = admin.firestore()

        // Get data.
        const { ceremonyId } = data
        const userId = context.auth?.uid

        // Look for the ceremony.
        const ceremonyDoc = await firestore.collection(commonTerms.collections.ceremonies.name).doc(ceremonyId).get()

        // Check existence.
        if (!ceremonyDoc.exists) printLog(COMMON_ERRORS.GENERR_INVALID_CEREMONY, LogLevel.ERROR)

        // Get ceremony data.
        const ceremonyData = ceremonyDoc.data()

        // Check if running.
        if (!ceremonyData || ceremonyData.state !== CeremonyState.OPENED)
            printLog(COMMON_ERRORS.GENERR_CEREMONY_NOT_OPENED, LogLevel.ERROR)

        printLog(`Ceremony document ${ceremonyId} okay`, LogLevel.DEBUG)

        // Look for the user among ceremony participants.
        const participantDoc = await firestore
            .collection(getParticipantsCollectionPath(ceremonyDoc.id))
            .doc(userId!)
            .get()

        // Check existence.
        if (!participantDoc.exists) printLog(COMMON_ERRORS.GENERR_INVALID_PARTICIPANT, LogLevel.ERROR)

        // Get participant data.
        const participantData = participantDoc.data()

        if (!participantData) printLog(COMMON_ERRORS.GENERR_NO_DATA, LogLevel.ERROR)

        printLog(`Participant document ${participantDoc.id} okay`, LogLevel.DEBUG)

        // Check if participant is able to advance to next contribution step.
        if (participantData?.status !== ParticipantStatus.CONTRIBUTING)
            printLog(`Participant ${participantDoc.id} is not contributing`, LogLevel.ERROR)

        // Make the advancement.
        let progress: string = ""

        if (participantData?.contributionStep === ParticipantContributionStep.DOWNLOADING)
            progress = ParticipantContributionStep.COMPUTING
        if (participantData?.contributionStep === ParticipantContributionStep.COMPUTING)
            progress = ParticipantContributionStep.UPLOADING
        if (participantData?.contributionStep === ParticipantContributionStep.UPLOADING)
            progress = ParticipantContributionStep.VERIFYING
        if (participantData?.contributionStep === ParticipantContributionStep.VERIFYING)
            progress = ParticipantContributionStep.COMPLETED

        printLog(`Current contribution step should be ${participantData?.contributionStep}`, LogLevel.DEBUG)
        printLog(`Next contribution step should be ${progress}`, LogLevel.DEBUG)

        if (progress === ParticipantContributionStep.VERIFYING)
            await participantDoc.ref.update({
                contributionStep: progress,
                verificationStartedAt: getCurrentServerTimestampInMillis(),
                lastUpdated: getCurrentServerTimestampInMillis()
            })
        else
            await participantDoc.ref.update({
                contributionStep: progress,
                lastUpdated: getCurrentServerTimestampInMillis()
            })
    }
)

/**
 * Temporary store the contribution computation time for the current contributor.
 */
export const temporaryStoreCurrentContributionComputationTime = functions.https.onCall(
    async (data: any, context: functions.https.CallableContext) => {
        // Check if sender is authenticated.
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            printLog(COMMON_ERRORS.GENERR_NO_AUTH_USER_FOUND, LogLevel.ERROR)

        if (!data.ceremonyId || data.contributionComputationTime <= 0)
            logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Get DB.
        const firestore = admin.firestore()

        // Get data.
        const { ceremonyId } = data
        const userId = context.auth?.uid

        // Look for documents.
        const ceremonyDoc = await firestore.collection(commonTerms.collections.ceremonies.name).doc(ceremonyId).get()
        const participantDoc = await firestore
            .collection(getParticipantsCollectionPath(ceremonyDoc.id))
            .doc(userId!)
            .get()

        // Check existence.
        if (!ceremonyDoc.exists) printLog(COMMON_ERRORS.GENERR_INVALID_CEREMONY, LogLevel.ERROR)
        if (!participantDoc.exists) printLog(COMMON_ERRORS.GENERR_INVALID_PARTICIPANT, LogLevel.ERROR)

        // Get data.
        const participantData = participantDoc.data()

        if (!participantData) printLog(COMMON_ERRORS.GENERR_NO_DATA, LogLevel.ERROR)

        printLog(`Ceremony document ${ceremonyId} okay`, LogLevel.DEBUG)
        printLog(`Participant document ${participantDoc.id} okay`, LogLevel.DEBUG)

        // Check if has reached the computing step while contributing.
        if (participantData?.contributionStep !== ParticipantContributionStep.COMPUTING)
            printLog(COMMON_ERRORS.GENERR_INVALID_PARTICIPANT_CONTRIBUTION_STEP, LogLevel.ERROR)

        // Update.
        await participantDoc.ref.set(
            {
                ...participantData!,
                tempContributionData: {
                    contributionComputationTime: data.contributionComputationTime
                },
                lastUpdated: getCurrentServerTimestampInMillis()
            },
            { merge: true }
        )
    }
)

/**
 * Permanently store the contribution computation hash for attestation generation for the current contributor.
 */
export const permanentlyStoreCurrentContributionTimeAndHash = functions.https.onCall(
    async (data: any, context: functions.https.CallableContext) => {
        // Check if sender is authenticated.
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            printLog(COMMON_ERRORS.GENERR_NO_AUTH_USER_FOUND, LogLevel.ERROR)

        if (!data.ceremonyId || data.contributionComputationTime <= 0 || !data.contributionHash)
            logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Get DB.
        const firestore = admin.firestore()

        // Get data.
        const { ceremonyId } = data
        const userId = context.auth?.uid

        // Look for documents.
        const ceremonyDoc = await firestore.collection(commonTerms.collections.ceremonies.name).doc(ceremonyId).get()
        const participantDoc = await firestore.collection(getParticipantsCollectionPath(ceremonyId)).doc(userId!).get()

        // Check existence.
        if (!ceremonyDoc.exists) printLog(COMMON_ERRORS.GENERR_INVALID_CEREMONY, LogLevel.ERROR)
        if (!participantDoc.exists) printLog(COMMON_ERRORS.GENERR_INVALID_PARTICIPANT, LogLevel.ERROR)

        // Get data.
        const participantData = participantDoc.data()

        if (!participantData) printLog(COMMON_ERRORS.GENERR_NO_DATA, LogLevel.ERROR)

        printLog(`Ceremony document ${ceremonyId} okay`, LogLevel.DEBUG)
        printLog(`Participant document ${participantDoc.id} okay`, LogLevel.DEBUG)

        // Check if has reached the computing step while contributing or is finalizing.
        if (
            participantData?.contributionStep === ParticipantContributionStep.COMPUTING ||
            (context?.auth?.token.coordinator && participantData?.status === ParticipantStatus.FINALIZING)
        )
            // Update.
            await participantDoc.ref.set(
                {
                    ...participantData!,
                    contributions: [
                        ...participantData!.contributions,
                        {
                            hash: data.contributionHash!,
                            computationTime: data.contributionComputationTime
                        }
                    ],
                    lastUpdated: getCurrentServerTimestampInMillis()
                },
                { merge: true }
            )
        else printLog(COMMON_ERRORS.GENERR_INVALID_PARTICIPANT_CONTRIBUTION_STEP, LogLevel.ERROR)
    }
)

/**
 * Temporary store the the Multi-Part Upload identifier for the current contributor.
 */
export const temporaryStoreCurrentContributionMultiPartUploadId = functions.https.onCall(
    async (data: any, context: functions.https.CallableContext) => {
        // Check if sender is authenticated.
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            printLog(COMMON_ERRORS.GENERR_NO_AUTH_USER_FOUND, LogLevel.ERROR)

        if (!data.ceremonyId || !data.uploadId) logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Get DB.
        const firestore = admin.firestore()

        // Get data.
        const { ceremonyId } = data
        const userId = context.auth?.uid

        // Look for documents.
        const ceremonyDoc = await firestore.collection(commonTerms.collections.ceremonies.name).doc(ceremonyId).get()
        const participantDoc = await firestore.collection(getParticipantsCollectionPath(ceremonyId)).doc(userId!).get()

        // Check existence.
        if (!ceremonyDoc.exists) printLog(COMMON_ERRORS.GENERR_INVALID_CEREMONY, LogLevel.ERROR)
        if (!participantDoc.exists) printLog(COMMON_ERRORS.GENERR_INVALID_PARTICIPANT, LogLevel.ERROR)

        // Get data.
        const participantData = participantDoc.data()

        if (!participantData) printLog(COMMON_ERRORS.GENERR_NO_DATA, LogLevel.ERROR)

        printLog(`Ceremony document ${ceremonyId} okay`, LogLevel.DEBUG)
        printLog(`Participant document ${participantDoc.id} okay`, LogLevel.DEBUG)

        // Check if has reached the uploading step while contributing.
        if (participantData?.contributionStep !== ParticipantContributionStep.UPLOADING)
            printLog(COMMON_ERRORS.GENERR_INVALID_PARTICIPANT_CONTRIBUTION_STEP, LogLevel.ERROR)

        // Update.
        await participantDoc.ref.set(
            {
                ...participantData!,
                tempContributionData: {
                    ...participantData?.tempContributionData,
                    uploadId: data.uploadId,
                    chunks: []
                },
                lastUpdated: getCurrentServerTimestampInMillis()
            },
            { merge: true }
        )
    }
)

/**
 * Temporary store the ETag and PartNumber for each uploaded chunk in order to make the upload resumable from last chunk.
 */
export const temporaryStoreCurrentContributionUploadedChunkData = functions.https.onCall(
    async (data: any, context: functions.https.CallableContext) => {
        // Check if sender is authenticated.
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            printLog(COMMON_ERRORS.GENERR_NO_AUTH_USER_FOUND, LogLevel.ERROR)

        if (!data.ceremonyId || !data.eTag || data.partNumber <= 0)
            logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Get DB.
        const firestore = admin.firestore()

        // Get data.
        const { ceremonyId } = data
        const userId = context.auth?.uid

        // Look for documents.
        const ceremonyDoc = await firestore.collection(commonTerms.collections.ceremonies.name).doc(ceremonyId).get()
        const participantDoc = await firestore.collection(getParticipantsCollectionPath(ceremonyId)).doc(userId!).get()

        // Check existence.
        if (!ceremonyDoc.exists) printLog(COMMON_ERRORS.GENERR_INVALID_CEREMONY, LogLevel.ERROR)
        if (!participantDoc.exists) printLog(COMMON_ERRORS.GENERR_INVALID_PARTICIPANT, LogLevel.ERROR)

        // Get data.
        const participantData = participantDoc.data()

        if (!participantData) printLog(COMMON_ERRORS.GENERR_NO_DATA, LogLevel.ERROR)

        printLog(`Ceremony document ${ceremonyId} okay`, LogLevel.DEBUG)
        printLog(`Participant document ${participantDoc.id} okay`, LogLevel.DEBUG)

        // Check if has reached the uploading step while contributing.
        if (participantData?.contributionStep !== ParticipantContributionStep.UPLOADING)
            printLog(COMMON_ERRORS.GENERR_INVALID_PARTICIPANT_CONTRIBUTION_STEP, LogLevel.ERROR)

        const chunks = participantData?.tempContributionData.chunks ? participantData?.tempContributionData.chunks : []

        // Add last chunk.
        chunks.push({
            ETag: data.eTag,
            PartNumber: data.partNumber
        })

        // Update.
        await participantDoc.ref.set(
            {
                ...participantData!,
                tempContributionData: {
                    ...participantData?.tempContributionData,
                    chunks
                },
                lastUpdated: getCurrentServerTimestampInMillis()
            },
            { merge: true }
        )
    }
)

/**
 * Check and prepare the coordinator for the ceremony finalization.
 */
export const checkAndPrepareCoordinatorForFinalization = functions.https.onCall(
    async (data: any, context: functions.https.CallableContext) => {
        // Check if sender is authenticated.
        if (!context.auth || !context.auth.token.coordinator)
            printLog(COMMON_ERRORS.GENERR_NO_AUTH_USER_FOUND, LogLevel.ERROR)

        if (!data.ceremonyId) printLog(COMMON_ERRORS.GENERR_NO_CEREMONY_PROVIDED, LogLevel.ERROR)

        // Get DB.
        const firestore = admin.firestore()

        // Get data.
        const { ceremonyId } = data
        const userId = context.auth?.uid

        // Look for the ceremony.
        const ceremonyDoc = await firestore.collection(commonTerms.collections.ceremonies.name).doc(ceremonyId).get()

        // Check existence.
        if (!ceremonyDoc.exists) printLog(COMMON_ERRORS.GENERR_INVALID_CEREMONY, LogLevel.ERROR)

        // Get ceremony data.
        const ceremonyData = ceremonyDoc.data()

        // Check if running.
        if (!ceremonyData || ceremonyData.state !== CeremonyState.CLOSED)
            printLog(COMMON_ERRORS.GENERR_CEREMONY_NOT_CLOSED, LogLevel.ERROR)

        // Look for the coordinator among ceremony participant.
        const participantDoc = await firestore.collection(getParticipantsCollectionPath(ceremonyId)).doc(userId!).get()

        // Check if the coordinator has completed the contributions for all circuits.
        const participantData = participantDoc.data()

        if (!participantData) printLog(COMMON_ERRORS.GENERR_NO_DATA, LogLevel.ERROR)

        printLog(`Participant document ${participantDoc.id} okay`, LogLevel.DEBUG)

        const circuits = await getCeremonyCircuits(getCircuitsCollectionPath(ceremonyDoc.id))

        // Already contributed to all circuits.
        if (
            participantData?.contributionProgress === circuits.length + 1 ||
            participantData?.status === ParticipantStatus.DONE
        ) {
            // Update participant status.
            await participantDoc.ref.set(
                {
                    status: ParticipantStatus.FINALIZING,
                    lastUpdated: getCurrentServerTimestampInMillis()
                },
                { merge: true }
            )

            printLog(`Coordinator ${participantDoc.id} ready for finalization`, LogLevel.DEBUG)

            return true
        }
        return false
    }
)
