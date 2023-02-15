import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { commonTerms, getParticipantsCollectionPath, getTimeoutsCollectionPath } from "@zkmpc/actions/src"
import {
    CeremonyState,
    ParticipantStatus,
    ParticipantContributionStep,
    CeremonyTimeoutType,
    TimeoutType
} from "@zkmpc/actions/src/types/enums"
import { ParticipantDocument } from "@zkmpc/actions/src/types"
import {
    getCeremonyCircuits,
    getCurrentServerTimestampInMillis,
    getDocumentById,
    queryNotExpiredTimeouts,
    queryOpenedCeremonies
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
 * Check and remove the current contributor if it doesn't complete the contribution on the specified amount of time.
 * @dev since this cloud function is executed every minute, delay problems may occur. See problem #192 for details.
 * @notice the reasons why a contributor may be considered blocking are many.
 * for example due to network latency, disk availability issues, un/intentional crashes, limited hardware capabilities.
 * the timeout mechanism (fixed/dynamic) could also influence this decision.
 * this cloud function should check each circuit and:
 * A) avoid timeout if there's no current contributor for the circuit.
 * B) avoid timeout if the current contributor is the first for the circuit
 * and timeout mechanism type is dynamic (suggestion: coordinator should be the first contributor).
 * C) check if the current contributor is a potential blocking contributor for the circuit.
 * D) discriminate between blocking contributor (= when downloading, computing, uploading contribution steps)
 * or verification (= verifying contribution step) timeout types.
 * E) execute timeout.
 * E.1) prepare next contributor (if any).
 * E.2) update circuit contributors waiting queue removing the current contributor.
 * E.3) assign timeout to blocking contributor (participant doc update + timeout doc).
 */
export const checkAndRemoveBlockingContributor = functions.pubsub.schedule("every 1 minutes").onRun(async () => {
    // Prepare Firestore DB.
    const firestore = admin.firestore()
    // Get current server timestamp in milliseconds.
    const currentServerTimestamp = getCurrentServerTimestampInMillis()

    // Get opened ceremonies.
    const ceremonies = await queryOpenedCeremonies()

    // For each ceremony.
    for (const ceremony of ceremonies) {
        if (!ceremony.data())
            // Do not use `logAndThrowError` method to avoid the function to exit before checking every ceremony.
            printLog(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA.message, LogLevel.WARN)
        else {
            // Get ceremony circuits.
            const circuits = await getCeremonyCircuits(ceremony.id)

            // Extract ceremony data.
            const { timeoutMechanismType, penalty } = ceremony.data()!

            for (const circuit of circuits) {
                if (!circuit.data())
                    // Do not use `logAndThrowError` method to avoid the function to exit before checking every ceremony.
                    printLog(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA.message, LogLevel.WARN)
                else {
                    // Extract circuit data.
                    const { waitingQueue, avgTimings, dynamicThreshold, fixedTimeWindow } = circuit.data()
                    const { contributors, currentContributor, failedContributions, completedContributions } =
                        waitingQueue
                    const {
                        fullContribution: avgFullContribution,
                        contributionComputation: avgContributionComputation,
                        verifyCloudFunction: avgVerifyCloudFunction
                    } = avgTimings

                    // Case (A).
                    if (!currentContributor)
                        // Do not use `logAndThrowError` method to avoid the function to exit before checking every ceremony.
                        printLog(
                            `No current contributor for circuit ${circuit.id} - ceremony ${ceremony.id}`,
                            LogLevel.WARN
                        )
                    else if (
                        avgFullContribution === 0 &&
                        avgContributionComputation === 0 &&
                        avgVerifyCloudFunction === 0 &&
                        completedContributions === 0 &&
                        timeoutMechanismType === CeremonyTimeoutType.DYNAMIC
                    )
                        printLog(
                            `No timeout will be executed for the first contributor to the circuit ${circuit.id} - ceremony ${ceremony.id}`,
                            LogLevel.WARN
                        )
                    else {
                        // Get current contributor document.
                        const participant = await getDocumentById(
                            getParticipantsCollectionPath(ceremony.id),
                            currentContributor
                        )

                        if (!participant.data())
                            // Do not use `logAndThrowError` method to avoid the function to exit before checking every ceremony.
                            printLog(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA.message, LogLevel.WARN)
                        else {
                            // Extract participant data.
                            const { contributionStartedAt, verificationStartedAt, contributionStep } =
                                participant.data()!

                            // Case (C).

                            // Compute dynamic timeout threshold.
                            const timeoutDynamicThreshold =
                                timeoutMechanismType === CeremonyTimeoutType.DYNAMIC
                                    ? (avgFullContribution / 100) * Number(dynamicThreshold)
                                    : 0

                            // Compute the timeout expiration date (in ms).
                            const timeoutExpirationDateInMsForBlockingContributor =
                                timeoutMechanismType === CeremonyTimeoutType.DYNAMIC
                                    ? Number(contributionStartedAt) +
                                      Number(avgFullContribution) +
                                      Number(timeoutDynamicThreshold)
                                    : Number(contributionStartedAt) + Number(fixedTimeWindow) * 60000 // * 60000 = convert minutes to millis.

                            // Case (D).
                            const timeoutExpirationDateInMsForVerificationCloudFunction =
                                contributionStep === ParticipantContributionStep.VERIFYING && !!verificationStartedAt
                                    ? Number(verificationStartedAt) + 3540000 // 3540000 = 59 minutes in ms.
                                    : 0

                            // Assign the timeout type.
                            let timeoutType: string = ""

                            if (
                                timeoutExpirationDateInMsForBlockingContributor < currentServerTimestamp &&
                                (contributionStep === ParticipantContributionStep.DOWNLOADING ||
                                    contributionStep === ParticipantContributionStep.COMPUTING ||
                                    contributionStep === ParticipantContributionStep.UPLOADING)
                            )
                                timeoutType = TimeoutType.BLOCKING_CONTRIBUTION

                            if (
                                timeoutExpirationDateInMsForVerificationCloudFunction > 0 &&
                                timeoutExpirationDateInMsForVerificationCloudFunction < currentServerTimestamp &&
                                contributionStep === ParticipantContributionStep.VERIFYING
                            )
                                timeoutType = TimeoutType.BLOCKING_CLOUD_FUNCTION

                            printLog(
                                `${timeoutType} detected for circuit ${circuit.id} - ceremony ${ceremony.id}`,
                                LogLevel.DEBUG
                            )

                            if (!timeoutType)
                                // Do not use `logAndThrowError` method to avoid the function to exit before checking every ceremony.
                                printLog(
                                    `No timeout for circuit ${circuit.id} - ceremony ${ceremony.id}`,
                                    LogLevel.WARN
                                )
                            else {
                                // Case (E).
                                let nextCurrentContributorId = ""

                                // Prepare Firestore batch of txs.
                                const batch = firestore.batch()

                                // Remove current contributor from waiting queue.
                                contributors.shift(1)

                                // Check if someone else is ready to start the contribution.
                                if (contributors.length > 0) {
                                    // Step (E.1).

                                    // Take the next participant to be current contributor.
                                    nextCurrentContributorId = contributors.at(0)

                                    // Get the document of the next current contributor.
                                    const nextCurrentContributor = await getDocumentById(
                                        getParticipantsCollectionPath(ceremony.id),
                                        nextCurrentContributorId
                                    )

                                    // Prepare next current contributor.
                                    batch.update(nextCurrentContributor.ref, {
                                        status: ParticipantStatus.WAITING,
                                        lastUpdated: getCurrentServerTimestampInMillis()
                                    })
                                }

                                // Step (E.2).
                                // Update accordingly the waiting queue.
                                batch.update(circuit.ref, {
                                    waitingQueue: {
                                        ...waitingQueue,
                                        contributors,
                                        currentContributor: nextCurrentContributorId,
                                        failedContributions: failedContributions + 1
                                    },
                                    lastUpdated: getCurrentServerTimestampInMillis()
                                })

                                // Step (E.3).
                                batch.update(participant.ref, {
                                    status: ParticipantStatus.TIMEDOUT,
                                    lastUpdated: getCurrentServerTimestampInMillis()
                                })

                                // Compute the timeout duration (penalty) in milliseconds.
                                const timeoutPenaltyInMs = Number(penalty) * 60000 // 60000 = amount of ms x minute.

                                // Prepare an empty doc for timeout (w/ auto-gen uid).
                                const timeout = await firestore
                                    .collection(getTimeoutsCollectionPath(ceremony.id, participant.id))
                                    .doc()
                                    .get()

                                // Prepare tx to store info about the timeout.
                                batch.create(timeout.ref, {
                                    type: timeoutType,
                                    startDate: currentServerTimestamp,
                                    endDate: currentServerTimestamp + timeoutPenaltyInMs
                                })

                                // Send atomic update for Firestore.
                                await batch.commit()

                                printLog(
                                    `The contributor ${participant.id} has been identified as potential blocking contributor. A timeout of type ${timeoutType} has been triggered w/ a penalty of ${timeoutPenaltyInMs} ms`,
                                    LogLevel.DEBUG
                                )
                            }
                        }
                    }
                }
            }
        }
    }
})

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
