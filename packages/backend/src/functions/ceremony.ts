import * as functions from "firebase-functions"
import dotenv from "dotenv"
import { DocumentSnapshot } from "firebase-functions/v1/firestore"
import { CeremonyState } from "@zkmpc/actions/src/types/enums"
import { queryCeremoniesByStateAndDate } from "../lib/utils"
import { printLog } from "../lib/errors"
import { LogLevel } from "../../types/enums"

dotenv.config()

/**
 * Automatically look and (if any) start scheduled ceremonies.
 */
export const startCeremony = functions.pubsub.schedule(`every 30 minutes`).onRun(async () => {
    // Get ceremonies in `scheduled` state.
    const scheduledCeremoniesQuerySnap = await queryCeremoniesByStateAndDate(CeremonyState.SCHEDULED, "startDate", "<=")

    if (scheduledCeremoniesQuerySnap.empty) printLog(`No ceremonies ready to be opened`, LogLevel.INFO)
    else {
        scheduledCeremoniesQuerySnap.forEach(async (ceremonyDoc: DocumentSnapshot) => {
            printLog(`Ceremony ${ceremonyDoc.id} opened`, LogLevel.INFO)

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

    if (runningCeremoniesQuerySnap.empty) printLog(`No ceremonies ready to be closed`, LogLevel.INFO)
    else {
        runningCeremoniesQuerySnap.forEach(async (ceremonyDoc: DocumentSnapshot) => {
            printLog(`Ceremony ${ceremonyDoc.id} closed`, LogLevel.INFO)

            // Update ceremony state to `finished`.
            await ceremonyDoc.ref.set({ state: CeremonyState.CLOSED }, { merge: true })
        })
    }
})
