import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import {
    getParticipantsCollectionPath,
    ParticipantStatus,
    commonTerms,
    timeoutCheck,
    printLog,
    COMMON_ERRORS
} from "@p0tion/actions"
import {
    getCurrentServerTimestampInMillis,
    getDocumentById
} from "../lib/utils"
import { logAndThrowError, SPECIFIC_ERRORS } from "../lib/errors"
import { LogLevel } from "../types/enums"

dotenv.config()

/**
 * Check and remove the current contributor if it doesn't complete the contribution on the specified amount of time.
 * @dev since this cloud function is executed every minute, delay problems may occur. See issue #192 (https://github.com/quadratic-funding/mpc-phase2-suite/issues/192).
 */
export const checkAndRemoveBlockingContributor = functions
    .region("europe-west1")
    .runWith({
        memory: "1GB"
    })
    .pubsub.schedule("every 1 minutes")
    .onRun(async () => {
        // Prepare Firestore DB.
        const firestore = admin.firestore()

        timeoutCheck(firestore)
    })

/**
 * Resume the contributor circuit contribution from scratch after the timeout expiration.
 * @dev The participant can resume the contribution if and only if the last timeout in progress was verified as expired (status == EXHUMED).
 */
export const resumeContributionAfterTimeoutExpiration = functions
    .region("europe-west1")
    .runWith({
        memory: "1GB"
    })
    .https.onCall(async (data: { ceremonyId: string }, context: functions.https.CallableContext): Promise<void> => {
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
        const { contributionProgress, status } = participantData!

        // Check pre-condition for resumable contribution after timeout expiration.
        if (status === ParticipantStatus.EXHUMED)
            await participantDoc.ref.update({
                status: ParticipantStatus.READY,
                lastUpdated: getCurrentServerTimestampInMillis(),
                tempContributionData: {}
            })
        else logAndThrowError(SPECIFIC_ERRORS.SE_CONTRIBUTE_CANNOT_PROGRESS_TO_NEXT_CIRCUIT)

        printLog(
            `Contributor ${userId} can retry the contribution for the circuit in position ${
                contributionProgress + 1
            } after timeout expiration`,
            LogLevel.DEBUG
        )
    })
