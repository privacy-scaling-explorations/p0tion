import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { CeremonyState, ParticipantStatus } from "../types/index.js"
import { GENERIC_ERRORS, showErrorOrLog } from "./lib/logs.js"
import { collections } from "./lib/constants.js"
import { getCurrentServerTimestampInMillis } from "./lib/utils.js"

dotenv.config()

/**
 * Check if a user is a participant for the given ceremony.
 * @dev the functions returns true if the user is not a participant and the function correctly register he/she. Otherwise, if already participant, the function returns false.
 */
export default functions.https.onCall(async (data: any, context: functions.https.CallableContext) => {
  // Check if sender is authenticated.
  if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
    showErrorOrLog(GENERIC_ERRORS.GENERR_NO_AUTH_USER_FOUND, true)

  if (!data.ceremonyId) showErrorOrLog(GENERIC_ERRORS.GENERR_NO_CEREMONY_PROVIDED, true)

  // Get DB.
  const firestore = admin.firestore()

  // Get data.
  const { ceremonyId } = data
  const userId = context.auth?.uid

  // Look for the ceremony.
  const ceremonyDoc = await firestore.collection(collections.ceremonies).doc(ceremonyId).get()

  // Check existence.
  if (!ceremonyDoc.exists) showErrorOrLog(GENERIC_ERRORS.GENERR_INVALID_CEREMONY, true)

  // Get ceremony data.
  const ceremonyData = ceremonyDoc.data()

  // Check if running.
  if (!ceremonyData || ceremonyData.state !== CeremonyState.OPENED)
    showErrorOrLog(GENERIC_ERRORS.GENERR_CEREMONY_NOT_OPENED, true)

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

    showErrorOrLog(`Participant document with UID ${userId} has been successfully created`, false)

    return true
  }

  showErrorOrLog(`Participant document with UID ${userId} already exists`, false)

  return false
})
