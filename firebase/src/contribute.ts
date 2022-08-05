import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { CeremonyState, MsgType, ParticipantStatus } from "../types/index.js"
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
export const checkAndRemoveBlockingContributor = functions.pubsub.schedule("every 5 minutes").onRun(async () => {
  if (
    !process.env.TIMEOUT_TOLERANCE_RATE ||
    !process.env.RETRY_WAITING_TIME_IN_DAYS ||
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
      const { contributeCommand, verifyCloudFunction } = avgTimings

      if (!currentContributor) logMsg(GENERIC_LOGS.GENLOG_NO_CURRENT_CONTRIBUTOR, MsgType.INFO)
      else {
        // Get current contributor data (i.e., participant).
        const participantDoc = await getParticipantById(ceremonyDoc.id, currentContributor)

        if (!participantDoc.exists || !participantDoc.data())
          logMsg(GENERIC_ERRORS.GENERR_INVALID_PARTICIPANT, MsgType.ERROR)

        const participantData = participantDoc.data()
        const contributionStartedAt = participantData?.contributionStartedAt

        logMsg(`Participant document ${participantDoc.id} okay`, MsgType.DEBUG)

        // Get average contribution time dinamically based on last waiting queue values for the circuit.
        const averageContributionTimeInMillis = contributeCommand + verifyCloudFunction
        const timeoutToleranceThreshold =
          (averageContributionTimeInMillis / 100) * Number(process.env.TIMEOUT_TOLERANCE_RATE)
        const timeoutExpirationDateInMillis =
          contributionStartedAt + averageContributionTimeInMillis + timeoutToleranceThreshold

        logMsg(`Average contribution time ${averageContributionTimeInMillis} ms`, MsgType.DEBUG)
        logMsg(`Timeout tolerance threshold set to ${timeoutToleranceThreshold}`, MsgType.DEBUG)
        logMsg(`Timeout expirartion date ${timeoutExpirationDateInMillis} ms`, MsgType.DEBUG)

        // Check if timeout should be triggered.
        if (timeoutExpirationDateInMillis < currentDate) {
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
          // Calculate retry waiting time in millis.
          const retryWaitingTimeInMillis = Number(process.env.RETRY_WAITING_TIME_IN_DAYS) * 86400000 // 86400000 = amount of millis in a day

          // Timeout collection.
          const timeoutDoc = await firestore
            .collection(
              `${collections.ceremonies}/${ceremonyDoc.id}/${collections.participants}/${participantDoc.id}/${collections.timeouts}`
            )
            .doc()
            .get()

          batch.create(timeoutDoc.ref, {
            startDate: currentDate,
            endDate: currentDate + retryWaitingTimeInMillis
          })

          logMsg(`Batch: add timeout document for blocking contributor`, MsgType.DEBUG)

          await batch.commit()

          logMsg(`Blocking contributor ${participantDoc.id} timedout`, MsgType.INFO)
        } else logMsg(GENERIC_LOGS.GENLOG_NO_TIMEOUT, MsgType.INFO)
      }
    }
  }
})
