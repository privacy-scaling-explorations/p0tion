import * as functions from "firebase-functions"
import dotenv from "dotenv"
import { DocumentSnapshot } from "firebase-functions/v1/firestore"
import { CeremonyState } from "@zkmpc/actions/src/types/enums"
import { commonTerms } from "@zkmpc/actions/src"
import { queryCeremoniesByStateAndDate } from "../lib/utils"
import { printLog } from "../lib/errors"
import { LogLevel } from "../../types/enums"

dotenv.config()

/**
 * Make a scheduled ceremony open.
 * @dev this function automatically runs every 30 minutes.
 * @todo this methodology for transitioning a ceremony from `scheduled` to `opened` state will be replaced with one
 * that resolves the issues presented in the issue #192.
 */
export const startCeremony = functions.pubsub.schedule(`every 30 minutes`).onRun(async () => {
    // Get ready to be opened ceremonies.
    const scheduledCeremoniesQuerySnap = await queryCeremoniesByStateAndDate(
        CeremonyState.SCHEDULED,
        commonTerms.collections.ceremonies.fields.startDate,
        "<="
    )

    if (!scheduledCeremoniesQuerySnap.empty)
        scheduledCeremoniesQuerySnap.forEach(async (ceremonyDoc: DocumentSnapshot) => {
            // Make state transition to start ceremony.
            await ceremonyDoc.ref.set({ state: CeremonyState.OPENED }, { merge: true })

            printLog(`Ceremony ${ceremonyDoc.id} is now open`, LogLevel.DEBUG)
        })
})

/**
 * Make a scheduled ceremony close.
 * @dev this function automatically runs every 30 minutes.
 * @todo this methodology for transitioning a ceremony from `opened` to `closed` state will be replaced with one
 * that resolves the issues presented in the issue #192.
 */
export const stopCeremony = functions.pubsub.schedule(`every 30 minutes`).onRun(async () => {
    // Get opened ceremonies.
    const runningCeremoniesQuerySnap = await queryCeremoniesByStateAndDate(
        CeremonyState.OPENED,
        commonTerms.collections.ceremonies.fields.endDate,
        "<="
    )

    if (!runningCeremoniesQuerySnap.empty) {
        runningCeremoniesQuerySnap.forEach(async (ceremonyDoc: DocumentSnapshot) => {
            // Make state transition to close ceremony.
            await ceremonyDoc.ref.set({ state: CeremonyState.CLOSED }, { merge: true })

            printLog(`Ceremony ${ceremonyDoc.id} is now closed`, LogLevel.DEBUG)
        })
    }
})
