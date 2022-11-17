import * as functions from "firebase-functions"
import dotenv from "dotenv"
import { DocumentSnapshot } from "firebase-functions/v1/firestore"
import { CeremonyState, MsgType } from "../../types/index.js"
import { queryCeremoniesByStateAndDate } from "../lib/utils.js"
import { GENERIC_LOGS, logMsg } from "../lib/logs.js"

dotenv.config()

/**
 * Automatically look and (if any) start scheduled ceremonies.
 */
export const startCeremony = functions.pubsub.schedule(`every 30 minutes`).onRun(async () => {
  // Get ceremonies in `scheduled` state.
  const scheduledCeremoniesQuerySnap = await queryCeremoniesByStateAndDate(CeremonyState.SCHEDULED, "startDate", "<=")

  if (scheduledCeremoniesQuerySnap.empty) logMsg(GENERIC_LOGS.GENLOG_NO_CEREMONIES_READY_TO_BE_OPENED, MsgType.INFO)
  else {
    scheduledCeremoniesQuerySnap.forEach(async (ceremonyDoc: DocumentSnapshot) => {
      logMsg(`Ceremony ${ceremonyDoc.id} opened`, MsgType.INFO)

      // Update ceremony state to `running`.
      await ceremonyDoc.ref.set({ state: CeremonyState.OPENED }, { merge: true })
    })
  }
})

/**
 * Automatically look and (if any) stop running ceremonies.
 */
export const stopCeremony = functions.pubsub.schedule(`every 30 minutes`).onRun(async () => {
  // Get ceremonies in `running` state.
  const runningCeremoniesQuerySnap = await queryCeremoniesByStateAndDate(CeremonyState.OPENED, "endDate", "<=")

  if (runningCeremoniesQuerySnap.empty) logMsg(GENERIC_LOGS.GENLOG_NO_CEREMONIES_READY_TO_BE_CLOSED, MsgType.INFO)
  else {
    runningCeremoniesQuerySnap.forEach(async (ceremonyDoc: DocumentSnapshot) => {
      logMsg(`Ceremony ${ceremonyDoc.id} closed`, MsgType.INFO)

      // Update ceremony state to `finished`.
      await ceremonyDoc.ref.set({ state: CeremonyState.CLOSED }, { merge: true })
    })
  }
})
