import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { DocumentSnapshot } from "firebase-functions/v1/firestore"
import { CeremonyState } from "../types/index.js"

dotenv.config()

/**
 * Automatically look and (if any) start scheduled ceremonies.
 */
export const startCeremony = functions.pubsub.schedule("every 60 minutes").onRun(async () => {
  // Get DB.
  const firestore = admin.firestore()

  // Get ceremonies in `scheduled` state.
  const scheduledCeremoniesQuerySnap = await firestore
    .collection("ceremonies")
    .where("state", "==", CeremonyState.SCHEDULED)
    .where("startDate", "<=", admin.firestore.Timestamp.now().toMillis())
    .get()

  if (scheduledCeremoniesQuerySnap.empty) functions.logger.debug(`There are no ceremonies ready to be opened!`)
  else {
    scheduledCeremoniesQuerySnap.forEach(async (ceremonyDoc: DocumentSnapshot) => {
      functions.logger.debug(`Ceremony ${ceremonyDoc.id} open!`)

      // Update ceremony state to `running`.
      await ceremonyDoc.ref.set({ state: CeremonyState.OPENED }, { merge: true })
    })
  }
})

/**
 * Automatically look and (if any) stop running ceremonies.
 */
export const stopCeremony = functions.pubsub.schedule("every 60 minutes").onRun(async () => {
  // Get DB.
  const firestore = admin.firestore()

  // Get ceremonies in `running` state.
  const runningCeremoniesQuerySnap = await firestore
    .collection("ceremonies")
    .where("state", "==", CeremonyState.OPENED)
    .where("endDate", "<=", admin.firestore.Timestamp.now().toMillis())
    .get()

  if (runningCeremoniesQuerySnap.empty) functions.logger.debug(`There are no running ceremonies ready to be closed!`)
  else {
    runningCeremoniesQuerySnap.forEach(async (ceremonyDoc: DocumentSnapshot) => {
      functions.logger.debug(`Ceremony ${ceremonyDoc.id} closed!`)

      // Update ceremony state to `finished`.
      await ceremonyDoc.ref.set({ state: CeremonyState.CLOSED }, { merge: true })
    })
  }
})
