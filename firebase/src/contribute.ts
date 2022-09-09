import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { CeremonyState, MsgType, ParticipantContributionStep, ParticipantStatus, TimeoutType } from "../types/index.js"
import { GENERIC_ERRORS, GENERIC_LOGS, logMsg } from "./lib/logs.js"
import { collections, timeoutsCollectionFields } from "./lib/constants.js"
import {
  getCeremonyCircuits,
  getCurrentServerTimestampInMillis,
  getParticipantById,
  queryCeremoniesByStateAndDate,
  queryValidTimeoutsByDate
} from "./lib/utils.js"

dotenv.config()

/**
 * Check if a user is a participant for the given ceremony.
 * @dev the functions returns true if the user is not a participant and the function correctly register he/she. Otherwise, if already participant, the function returns false.
 */
export const checkAndRegisterParticipant = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    // Check if sender is authenticated.
    if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
      logMsg(GENERIC_ERRORS.GENERR_NO_AUTH_USER_FOUND, MsgType.ERROR)

    if (!data.ceremonyId) logMsg(GENERIC_ERRORS.GENERR_NO_CEREMONY_PROVIDED, MsgType.ERROR)

    // Get DB.
    const firestore = admin.firestore()

    // Get data.
    const { ceremonyId } = data
    const userId = context.auth?.uid

    // Look for the ceremony.
    const ceremonyDoc = await firestore.collection(collections.ceremonies).doc(ceremonyId).get()

    // Check existence.
    if (!ceremonyDoc.exists) logMsg(GENERIC_ERRORS.GENERR_INVALID_CEREMONY, MsgType.ERROR)

    // Get ceremony data.
    const ceremonyData = ceremonyDoc.data()

    // Check if running.
    if (!ceremonyData || ceremonyData.state !== CeremonyState.OPENED)
      logMsg(GENERIC_ERRORS.GENERR_CEREMONY_NOT_OPENED, MsgType.ERROR)

    // Look for the user among ceremony participants.
    const participantDoc = await firestore
      .collection(`${collections.ceremonies}/${ceremonyId}/${collections.participants}`)
      .doc(userId!)
      .get()

    if (!participantDoc.exists) {
      // Create a new Participant doc for the sender.
      await participantDoc.ref.set({
        status: ParticipantStatus.CREATED,
        contributionProgress: 0,
        contributions: [],
        lastUpdated: getCurrentServerTimestampInMillis()
      })

      logMsg(`User ${userId} has been registered as participant for ceremony ${ceremonyDoc.id}`, MsgType.INFO)

      return true
    }

    // Check if the participant has completed the contributions for all circuits.
    const participantData = participantDoc.data()

    if (!participantData) logMsg(GENERIC_ERRORS.GENERR_NO_DATA, MsgType.ERROR)

    logMsg(`Participant document ${participantDoc.id} okay`, MsgType.DEBUG)

    const circuits = await getCeremonyCircuits(`${collections.ceremonies}/${ceremonyDoc.id}/${collections.circuits}`)

    // Already contributed to all circuits or currently contributor without any timeout.
    if (
      participantData?.contributionProgress === circuits.length + 1 ||
      participantData?.status === ParticipantStatus.CONTRIBUTING
    ) {
      logMsg(
        `Participant ${participantDoc.id} has already contributed to all circuits or is the current contributor to that circuit (no timed out yet)`,
        MsgType.DEBUG
      )

      return false
    }

    // Get `valid` timeouts (i.e., endDate is not expired).
    const validTimeoutsQuerySnap = await queryValidTimeoutsByDate(
      ceremonyDoc.id,
      participantDoc.id,
      timeoutsCollectionFields.endDate
    )

    if (validTimeoutsQuerySnap.empty) {
      // The participant can retry the contribution.
      await participantDoc.ref.set(
        {
          status: ParticipantStatus.READY,
          lastUpdated: getCurrentServerTimestampInMillis()
        },
        { merge: true }
      )

      logMsg(`Participant ${participantDoc.id} can retry the contribution from right now`, MsgType.DEBUG)

      return true
    }
    return false
  }
)

/**
 * Check and remove the current contributor who is taking more than a specified amount of time for completing the contribution.
 */
export const checkAndRemoveBlockingContributor = functions.pubsub.schedule("every 1 minutes").onRun(async () => {
  if (
    !process.env.TIMEOUT_TOLERANCE_RATE ||
    !process.env.BC_RETRY_WAITING_TIME_IN_DAYS ||
    !process.env.CF_RETRY_WAITING_TIME_IN_DAYS ||
    Number(process.env.TIMEOUT_TOLERANCE_RATE) < 0 ||
    Number(process.env.TIMEOUT_TOLERANCE_RATE) > 100
  )
    logMsg(GENERIC_ERRORS.GENERR_WRONG_ENV_CONFIGURATION, MsgType.ERROR)

  // Get DB.
  const firestore = admin.firestore()
  const currentDate = getCurrentServerTimestampInMillis()

  // Get ceremonies in `opened` state.
  const openedCeremoniesQuerySnap = await queryCeremoniesByStateAndDate(CeremonyState.OPENED, "endDate", ">=")

  if (openedCeremoniesQuerySnap.empty) logMsg(GENERIC_ERRORS.GENERR_NO_CEREMONIES_OPENED, MsgType.ERROR)

  // For each ceremony.
  for (const ceremonyDoc of openedCeremoniesQuerySnap.docs) {
    if (!ceremonyDoc.exists || !ceremonyDoc.data()) logMsg(GENERIC_ERRORS.GENERR_INVALID_CEREMONY, MsgType.ERROR)

    logMsg(`Ceremony document ${ceremonyDoc.id} okay`, MsgType.DEBUG)

    // Get circuits.
    const circuitsDocs = await getCeremonyCircuits(
      `${collections.ceremonies}/${ceremonyDoc.id}/${collections.circuits}`
    )

    // For each circuit.
    for (const circuitDoc of circuitsDocs) {
      if (!circuitDoc.exists || !circuitDoc.data()) logMsg(GENERIC_ERRORS.GENERR_INVALID_CIRCUIT, MsgType.ERROR)

      const circuitData = circuitDoc.data()

      logMsg(`Circuit document ${circuitDoc.id} okay`, MsgType.DEBUG)

      const { waitingQueue, avgTimings } = circuitData
      const { contributors, currentContributor, failedContributions } = waitingQueue
      const { fullContribution: avgFullContribution } = avgTimings

      if (!currentContributor) logMsg(GENERIC_LOGS.GENLOG_NO_CURRENT_CONTRIBUTOR, MsgType.INFO)
      else {
        // Get current contributor data (i.e., participant).
        const participantDoc = await getParticipantById(ceremonyDoc.id, currentContributor)

        if (!participantDoc.exists || !participantDoc.data())
          logMsg(GENERIC_ERRORS.GENERR_INVALID_PARTICIPANT, MsgType.ERROR)

        const participantData = participantDoc.data()
        const contributionStartedAt = participantData?.contributionStartedAt
        const verificationStartedAt = participantData?.verificationStartedAt
        const currentContributionStep = participantData?.contributionStep

        logMsg(`Participant document ${participantDoc.id} okay`, MsgType.DEBUG)

        // Check for blocking contributions (frontend-side).
        const timeoutToleranceThreshold = (avgFullContribution / 100) * Number(process.env.TIMEOUT_TOLERANCE_RATE)
        const timeoutExpirationDateInMillisForBlockingContributor =
          Number(contributionStartedAt) + Number(avgFullContribution) + Number(timeoutToleranceThreshold)

        logMsg(`Contribution start date ${contributionStartedAt}`, MsgType.DEBUG)
        logMsg(`Average contribution per circuit time ${avgFullContribution} ms`, MsgType.DEBUG)
        logMsg(`Timeout tolerance threshold set to ${timeoutToleranceThreshold}`, MsgType.DEBUG)
        logMsg(`BC Timeout expirartion date ${timeoutExpirationDateInMillisForBlockingContributor} ms`, MsgType.DEBUG)

        // Check for blocking verifications (backend-side).
        const timeoutExpirationDateInMillisForBlockingFunction = !verificationStartedAt
          ? 0
          : Number(verificationStartedAt) + 3540000 // 3540000 = 59 minutes in ms.

        logMsg(`Verification start date ${verificationStartedAt}`, MsgType.DEBUG)
        logMsg(`CF Timeout expirartion date ${timeoutExpirationDateInMillisForBlockingFunction} ms`, MsgType.DEBUG)

        // Get timeout type.
        let timeoutType = 0

        if (
          timeoutExpirationDateInMillisForBlockingContributor < currentDate &&
          currentContributionStep >= ParticipantContributionStep.DOWNLOADING &&
          currentContributionStep <= ParticipantContributionStep.UPLOADING
        )
          timeoutType = TimeoutType.BLOCKING_CONTRIBUTION

        if (
          timeoutExpirationDateInMillisForBlockingFunction > 0 &&
          timeoutExpirationDateInMillisForBlockingFunction < currentDate &&
          currentContributionStep === ParticipantContributionStep.VERIFYING
        )
          timeoutType = TimeoutType.BLOCKING_CLOUD_FUNCTION

        logMsg(`Timeout type ${timeoutType}`, MsgType.DEBUG)

        // Check if one timeout should be triggered.
        if (timeoutType !== 0) {
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
              .collection(`${collections.ceremonies}/${ceremonyDoc.id}/${collections.participants}`)
              .doc(newCurrentContributor)
              .get()

            if (newCurrentContributorDoc.exists) {
              batch.update(newCurrentContributorDoc.ref, {
                status: ParticipantStatus.CONTRIBUTING,
                contributionStep: ParticipantContributionStep.DOWNLOADING,
                contributionStartedAt: currentDate,
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

          logMsg(`Batch: update for circuit' waiting queue`, MsgType.DEBUG)

          // 2. Change blocking contributor status.
          batch.update(participantDoc.ref, {
            status: ParticipantStatus.TIMEDOUT,
            lastUpdated: getCurrentServerTimestampInMillis()
          })

          logMsg(`Batch: change blocking contributor status to TIMEDOUT`, MsgType.DEBUG)

          // 3. Create a new collection of timeouts (to keep track of participants timeouts).
          const retryWaitingTimeInMillis =
            timeoutExpirationDateInMillisForBlockingContributor < currentDate
              ? Number(process.env.BC_RETRY_WAITING_TIME_IN_DAYS) * 86400000
              : Number(process.env.CF_RETRY_WAITING_TIME_IN_DAYS) * 86400000 // 86400000 = amount of ms x day.

          // Timeout collection.
          const timeoutDoc = await firestore
            .collection(
              `${collections.ceremonies}/${ceremonyDoc.id}/${collections.participants}/${participantDoc.id}/${collections.timeouts}`
            )
            .doc()
            .get()

          batch.create(timeoutDoc.ref, {
            type: timeoutType,
            startDate: currentDate,
            endDate: currentDate + retryWaitingTimeInMillis
          })

          logMsg(`Batch: add timeout document for blocking contributor`, MsgType.DEBUG)

          await batch.commit()

          logMsg(`Blocking contributor ${participantDoc.id} timedout. Cause ${timeoutType}`, MsgType.INFO)
        } else logMsg(GENERIC_LOGS.GENLOG_NO_TIMEOUT, MsgType.INFO)
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
      logMsg(GENERIC_ERRORS.GENERR_NO_AUTH_USER_FOUND, MsgType.ERROR)

    if (!data.ceremonyId) logMsg(GENERIC_ERRORS.GENERR_NO_CEREMONY_PROVIDED, MsgType.ERROR)

    // Get DB.
    const firestore = admin.firestore()

    // Get data.
    const { ceremonyId } = data
    const userId = context.auth?.uid

    // Look for the ceremony.
    const ceremonyDoc = await firestore.collection(collections.ceremonies).doc(ceremonyId).get()

    // Check existence.
    if (!ceremonyDoc.exists) logMsg(GENERIC_ERRORS.GENERR_INVALID_CEREMONY, MsgType.ERROR)

    // Get ceremony data.
    const ceremonyData = ceremonyDoc.data()

    // Check if running.
    if (!ceremonyData || ceremonyData.state !== CeremonyState.OPENED)
      logMsg(GENERIC_ERRORS.GENERR_CEREMONY_NOT_OPENED, MsgType.ERROR)

    logMsg(`Ceremony document ${ceremonyId} okay`, MsgType.DEBUG)

    // Look for the user among ceremony participants.
    const participantDoc = await firestore
      .collection(`${collections.ceremonies}/${ceremonyId}/${collections.participants}`)
      .doc(userId!)
      .get()

    // Check existence.
    if (!participantDoc.exists) logMsg(GENERIC_ERRORS.GENERR_INVALID_PARTICIPANT, MsgType.ERROR)

    // Get participant data.
    const participantData = participantDoc.data()

    if (!participantData) logMsg(GENERIC_ERRORS.GENERR_NO_DATA, MsgType.ERROR)

    logMsg(`Participant document ${participantDoc.id} okay`, MsgType.DEBUG)

    // Check if participant is able to advance to next contribution step.
    if (participantData?.status !== ParticipantStatus.CONTRIBUTING)
      logMsg(`Participant ${participantDoc.id} is not contributing`, MsgType.ERROR)

    // Make the advancement.
    const progress = participantData?.contributionStep + 1

    logMsg(`Current contribution step should be ${participantData?.contributionStep}`, MsgType.DEBUG)
    logMsg(`Next contribution step should be ${progress}`, MsgType.DEBUG)

    // nb. DOWNLOADING (=1) must be set when coordinating the waiting queue while COMPLETED (=5) must be set in verifyContribution().
    if (progress <= ParticipantContributionStep.DOWNLOADING || progress >= ParticipantContributionStep.COMPLETED)
      logMsg(`Wrong contribution step ${progress} for ${participantDoc.id}`, MsgType.ERROR)

    // Update participant doc.
    await participantDoc.ref.set(
      {
        contributionStep: progress,
        verificationStartedAt:
          progress === ParticipantContributionStep.VERIFYING ? getCurrentServerTimestampInMillis() : 0,
        lastUpdated: getCurrentServerTimestampInMillis()
      },
      { merge: true }
    )
  }
)
