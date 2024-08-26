import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import {
    CeremonyTimeoutType,
    getParticipantsCollectionPath,
    ParticipantContributionStep,
    TimeoutType,
    ParticipantStatus,
    getTimeoutsCollectionPath,
    commonTerms
} from "@p0tion/actions"
import {
    getCeremonyCircuits,
    getCurrentServerTimestampInMillis,
    getDocumentById,
    queryOpenedCeremonies
} from "../lib/utils"
import { COMMON_ERRORS, logAndThrowError, printLog, SPECIFIC_ERRORS } from "../lib/errors"
import { LogLevel } from "../types/enums"

dotenv.config()

/**
 * Check and remove the current contributor if it doesn't complete the contribution on the specified amount of time.
 * @dev since this cloud function is executed every minute, delay problems may occur. See issue #192 (https://github.com/quadratic-funding/mpc-phase2-suite/issues/192).
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
export const checkAndRemoveBlockingContributor = functions
    .region("europe-west1")
    .runWith({
        memory: "1GB"
    })
    .pubsub.schedule("every 1 minutes")
    .onRun(async () => {
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
                const { timeoutType: timeoutMechanismType, penalty } = ceremony.data()!

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
                                    contributionStep === ParticipantContributionStep.VERIFYING &&
                                    !!verificationStartedAt
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
                                    contributors.shift()

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
                                            status: ParticipantStatus.READY,
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
