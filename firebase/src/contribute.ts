import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { CeremonyState, ParticipantStatus } from "../types/index.js"

dotenv.config()

/**
 * Check if a user is a participant for the given ceremony.
 * @dev the functions returns true if the user is not a participant and the function correctly register he/she. Otherwise, if already participant, the function returns false.
 */
export default functions.https.onCall(async (data: any, context: functions.https.CallableContext) => {
  // Check if sender is authenticated.
  if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator)) {
    functions.logger.error(`The sender is not an authenticated user!`)
    throw new Error(`The sender is not an authenticated user!`)
  }

  if (!data.ceremonyId) {
    functions.logger.error(`No ceremony provided!`)
    throw new Error(`No ceremony provided!`)
  }

  // Get DB.
  const firestore = admin.firestore()

  // Get data.
  const { ceremonyId } = data
  const userId = context.auth.uid

  // Look for the ceremony.
  const ceremonyDoc = await firestore.collection("ceremonies").doc(ceremonyId).get()

  // Check existence.
  if (!ceremonyDoc.exists) {
    functions.logger.error(`You must provide a valid ceremony!`)
    throw new Error(`You must provide a valid ceremony!`)
  }

  const ceremonyData = ceremonyDoc.data()

  // Check if running.
  if (!ceremonyData || ceremonyData.state !== CeremonyState.OPENED) {
    functions.logger.error(`You must choose a valid opened ceremony!`)
    throw new Error("You must choose a valid opened ceremony!")
  }

  // Look for the user among ceremony participants.
  const participantDoc = await firestore.collection(`ceremonies/${ceremonyId}/participants`).doc(userId).get()

  if (!participantDoc.exists) {
    // Create a new Participant doc for the sender.
    await participantDoc.ref.set({
      status: ParticipantStatus.WAITING,
      contributionProgress: 0,
      contributions: []
    })

    functions.logger.info(`Participant document with UID ${userId} has been successfully created`)

    return true
  }

  functions.logger.info(`Participant document with UID ${userId} already exists`)

  return false
})
