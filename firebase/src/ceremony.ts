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

  scheduledCeremoniesQuerySnap.forEach(async (ceremonyDoc: DocumentSnapshot) => {
    functions.logger.debug(`Ceremony ${ceremonyDoc.id} is ready to start!`)

    // Update ceremony state to `running`.
    await ceremonyDoc.ref.set({ state: CeremonyState.RUNNING }, { merge: true })
  })
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
    .where("state", "==", CeremonyState.RUNNING)
    .where("endDate", "<=", admin.firestore.Timestamp.now())
    .get()

  runningCeremoniesQuerySnap.forEach(async (ceremonyDoc: DocumentSnapshot) => {
    functions.logger.debug(`Ceremony ${ceremonyDoc.id} is going to end now!`)

    // Update ceremony state to `finished`.
    await ceremonyDoc.ref.set({ state: CeremonyState.FINISHED }, { merge: true })
  })
})
