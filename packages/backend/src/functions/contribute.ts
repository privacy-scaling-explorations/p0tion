import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import {
    commonTerms,
    getCircuitsCollectionPath,
    getParticipantsCollectionPath,
    getTimeoutsCollectionPath
} from "@zkmpc/actions/src"
import {
    CeremonyState,
    ParticipantStatus,
    ParticipantContributionStep,
    CeremonyTimeoutType,
    TimeoutType
} from "@zkmpc/actions/src/types/enums"
import {
    getCeremonyCircuits,
    getCurrentServerTimestampInMillis,
    getDocumentById,
    queryCeremoniesByStateAndDate,
    queryValidTimeoutsByDate
} from "../lib/utils"
import { COMMON_ERRORS, logAndThrowError, printLog } from "../lib/errors"
import { LogLevel } from "../../types/enums"

dotenv.config()

/**
 * Check if a user can participate for the given ceremony (e.g., new contributor, after timeout expiration, etc.).
 */
export const checkParticipantForCeremony = functions.https.onCall(
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

        // Look for the user among ceremony participants.
        const participantDoc = await firestore.collection(getParticipantsCollectionPath(ceremonyId)).doc(userId!).get()

        if (!participantDoc.exists) {
            // Create a new Participant doc for the sender.
            await participantDoc.ref.set({
                status: ParticipantStatus.WAITING,
                contributionProgress: 0,
                contributions: [],
                lastUpdated: getCurrentServerTimestampInMillis()
            })

            printLog(`User ${userId} has been registered as participant for ceremony ${ceremonyDoc.id}`, LogLevel.INFO)
        } else {
            // Check if the participant has completed the contributions for all circuits.
            const participantData = participantDoc.data()

            if (!participantData) printLog(COMMON_ERRORS.GENERR_NO_DATA, LogLevel.ERROR)

            printLog(`Participant document ${participantDoc.id} okay`, LogLevel.DEBUG)

            const circuits = await getCeremonyCircuits(getCircuitsCollectionPath(ceremonyDoc.id))

            // Already contributed to all circuits or currently contributor without any timeout.
            if (
                participantData?.contributionProgress === circuits.length &&
                participantData?.status === ParticipantStatus.DONE
            ) {
                printLog(
                    `Participant ${participantDoc.id} has already contributed to all circuits or is the current contributor to that circuit (no timed out yet)`,
                    LogLevel.DEBUG
                )

                return false
            }

            if (participantData?.status === ParticipantStatus.TIMEDOUT) {
                // Get `valid` timeouts (i.e., endDate is not expired).
                const validTimeoutsQuerySnap = await queryValidTimeoutsByDate(
                    ceremonyDoc.id,
                    participantDoc.id,
                    commonTerms.collections.timeouts.fields.endDate
                )

                if (validTimeoutsQuerySnap.empty) {
                    // @todo need to remove unstable contributions (only one without doc link) and temp data, contributor must restart from step 1.
                    // The participant can retry the contribution.
                    await participantDoc.ref.set(
                        {
                            status: ParticipantStatus.EXHUMED,
                            contributionStep: ParticipantContributionStep.DOWNLOADING,
                            lastUpdated: getCurrentServerTimestampInMillis()
                        },
                        { merge: true }
                    )

                    printLog(
                        `Participant ${participantDoc.id} can retry the contribution from right now`,
                        LogLevel.DEBUG
                    )

                    return true
                }
                printLog(`Participant ${participantDoc.id} cannot retry the contribution yet`, LogLevel.DEBUG)

                return false
            }
        }

        return true
    }
)

/**
 * Check and remove the current contributor who is taking more than a specified amount of time for completing the contribution.
 */
export const checkAndRemoveBlockingContributor = functions.pubsub.schedule("every 1 minutes").onRun(async () => {
    // Get DB.
    const firestore = admin.firestore()
    const currentDate = getCurrentServerTimestampInMillis()

    // Get ceremonies in `opened` state.
    const openedCeremoniesQuerySnap = await queryCeremoniesByStateAndDate(
        CeremonyState.OPENED,
        commonTerms.collections.ceremonies.fields.endDate,
        ">="
    )

    if (openedCeremoniesQuerySnap.empty) printLog(COMMON_ERRORS.GENERR_NO_CEREMONIES_OPENED, LogLevel.ERROR)

    // For each ceremony.
    for (const ceremonyDoc of openedCeremoniesQuerySnap.docs) {
        if (!ceremonyDoc.exists || !ceremonyDoc.data()) printLog(COMMON_ERRORS.GENERR_INVALID_CEREMONY, LogLevel.ERROR)

        printLog(`Ceremony document ${ceremonyDoc.id} okay`, LogLevel.DEBUG)

        // Get data.
        const { timeoutType: ceremonyTimeoutType, penalty } = ceremonyDoc.data()

        // Get circuits.
        const circuitsDocs = await getCeremonyCircuits(getCircuitsCollectionPath(ceremonyDoc.id))

        // For each circuit.
        for (const circuitDoc of circuitsDocs) {
            if (!circuitDoc.exists || !circuitDoc.data()) printLog(COMMON_ERRORS.GENERR_INVALID_CIRCUIT, LogLevel.ERROR)

            const circuitData = circuitDoc.data()

            printLog(`Circuit document ${circuitDoc.id} okay`, LogLevel.DEBUG)

            // Get data.
            const { waitingQueue, avgTimings } = circuitData
            const { contributors, currentContributor, failedContributions, completedContributions } = waitingQueue
            const { fullContribution: avgFullContribution } = avgTimings

            // Check for current contributor.
            if (!currentContributor) printLog(COMMON_ERRORS.GENERR_NO_CURRENT_CONTRIBUTOR, LogLevel.WARN)

            // Check if first contributor.
            if (
                !currentContributor &&
                avgFullContribution === 0 &&
                completedContributions === 0 &&
                ceremonyTimeoutType === CeremonyTimeoutType.DYNAMIC
            )
                printLog(COMMON_ERRORS.GENERR_NO_TIMEOUT_FIRST_COTRIBUTOR, LogLevel.DEBUG)

            if (
                !!currentContributor &&
                ((avgFullContribution > 0 && completedContributions > 0) ||
                    ceremonyTimeoutType === CeremonyTimeoutType.FIXED)
            ) {
                // Get current contributor data (i.e., participant).
                const participantDoc = await getDocumentById(
                    getParticipantsCollectionPath(ceremonyDoc.id),
                    currentContributor
                )

                if (!participantDoc.data()) printLog(COMMON_ERRORS.GENERR_INVALID_PARTICIPANT, LogLevel.WARN)
                else {
                    const participantData = participantDoc.data()
                    const contributionStartedAt = participantData?.contributionStartedAt
                    const verificationStartedAt = participantData?.verificationStartedAt
                    const currentContributionStep = participantData?.contributionStep

                    printLog(`Participant document ${participantDoc.id} okay`, LogLevel.DEBUG)

                    // Check for blocking contributions (frontend-side).
                    const timeoutToleranceThreshold =
                        ceremonyTimeoutType === CeremonyTimeoutType.DYNAMIC
                            ? (avgFullContribution / 100) * Number(circuitData.dynamicThreshold)
                            : 0

                    const timeoutExpirationDateInMillisForBlockingContributor =
                        ceremonyTimeoutType === CeremonyTimeoutType.DYNAMIC
                            ? Number(contributionStartedAt) +
                              Number(avgFullContribution) +
                              Number(timeoutToleranceThreshold)
                            : Number(contributionStartedAt) + Number(circuitData.fixedTimeWindow) * 60000 // * 60000 = to convert millis in minutes.

                    printLog(`Contribution start date ${contributionStartedAt}`, LogLevel.DEBUG)
                    if (ceremonyTimeoutType === CeremonyTimeoutType.DYNAMIC) {
                        printLog(`Average contribution per circuit time ${avgFullContribution} ms`, LogLevel.DEBUG)
                        printLog(`Timeout tolerance threshold set to ${timeoutToleranceThreshold}`, LogLevel.DEBUG)
                    }
                    printLog(
                        `BC Timeout expirartion date ${timeoutExpirationDateInMillisForBlockingContributor} ms`,
                        LogLevel.DEBUG
                    )

                    // Check for blocking verifications (backend-side).
                    const timeoutExpirationDateInMillisForBlockingFunction = !verificationStartedAt
                        ? 0
                        : Number(verificationStartedAt) + 3540000 // 3540000 = 59 minutes in ms.

                    printLog(`Verification start date ${verificationStartedAt}`, LogLevel.DEBUG)
                    printLog(
                        `CF Timeout expirartion date ${timeoutExpirationDateInMillisForBlockingFunction} ms`,
                        LogLevel.DEBUG
                    )

                    // Get timeout type.
                    let timeoutType: string = ""

                    if (
                        timeoutExpirationDateInMillisForBlockingContributor < currentDate &&
                        (currentContributionStep === ParticipantContributionStep.DOWNLOADING ||
                            currentContributionStep === ParticipantContributionStep.COMPUTING ||
                            currentContributionStep === ParticipantContributionStep.UPLOADING)
                    )
                        timeoutType = TimeoutType.BLOCKING_CONTRIBUTION

                    if (
                        timeoutExpirationDateInMillisForBlockingFunction > 0 &&
                        timeoutExpirationDateInMillisForBlockingFunction < currentDate &&
                        currentContributionStep === ParticipantContributionStep.VERIFYING
                    )
                        timeoutType = TimeoutType.BLOCKING_CLOUD_FUNCTION

                    printLog(`Ceremony Timeout type ${ceremonyTimeoutType}`, LogLevel.DEBUG)
                    printLog(`Timeout type ${timeoutType}`, LogLevel.DEBUG)

                    // Check if one timeout should be triggered.
                    if (
                        timeoutType === TimeoutType.BLOCKING_CLOUD_FUNCTION ||
                        timeoutType === TimeoutType.BLOCKING_CONTRIBUTION
                    ) {
                        // Timeout the participant.
                        const batch = firestore.batch()

                        // 1. Update circuit' waiting queue.
                        contributors.shift(1)

                        let newCurrentContributor = ""

                        if (contributors.length > 0) {
                            // There's someone else ready to contribute.
                            newCurrentContributor = contributors.at(0)

                            // Pass the baton to the next participant.
                            const newCurrentContributorDoc = await firestore
                                .collection(getParticipantsCollectionPath(ceremonyDoc.id))
                                .doc(newCurrentContributor)
                                .get()

                            if (newCurrentContributorDoc.exists) {
                                batch.update(newCurrentContributorDoc.ref, {
                                    status: ParticipantStatus.WAITING,
                                    lastUpdated: getCurrentServerTimestampInMillis()
                                })
                            }
                        }

                        batch.update(circuitDoc.ref, {
                            waitingQueue: {
                                ...circuitData.waitingQueue,
                                contributors,
                                currentContributor: newCurrentContributor,
                                failedContributions: failedContributions + 1
                            },
                            lastUpdated: getCurrentServerTimestampInMillis()
                        })

                        printLog(`Batch: update for circuit' waiting queue`, LogLevel.DEBUG)

                        // 2. Change blocking contributor status.
                        batch.update(participantDoc.ref, {
                            status: ParticipantStatus.TIMEDOUT,
                            lastUpdated: getCurrentServerTimestampInMillis()
                        })

                        printLog(`Batch: change blocking contributor status to TIMEDOUT`, LogLevel.DEBUG)

                        // 3. Create a new collection of timeouts (to keep track of participants timeouts).
                        const retryWaitingTimeInMillis = Number(penalty) * 60000 // 60000 = amount of ms x minute.

                        // Timeout collection.
                        const timeoutDoc = await firestore
                            .collection(getTimeoutsCollectionPath(ceremonyDoc.id, participantDoc.id))
                            .doc()
                            .get()

                        batch.create(timeoutDoc.ref, {
                            type: timeoutType,
                            startDate: currentDate,
                            endDate: currentDate + retryWaitingTimeInMillis
                        })

                        printLog(`Batch: add timeout document for blocking contributor`, LogLevel.DEBUG)

                        await batch.commit()

                        printLog(
                            `Blocking contributor ${participantDoc.id} timedout. Cause ${timeoutType}`,
                            LogLevel.INFO
                        )
                    } else printLog(`No timeout`, LogLevel.INFO)
                }
            }
        }
    }
})

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
