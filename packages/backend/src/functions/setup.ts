import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { QueryDocumentSnapshot } from "firebase-functions/v1/firestore"
import { CeremonyState, CeremonyType, MsgType } from "../../types/index"
import { GENERIC_ERRORS, logMsg } from "../lib/logs"
import { getCurrentServerTimestampInMillis } from "../lib/utils"
import { collections } from "../lib/constants"

dotenv.config()

/**
 * Bootstrap/Setup every necessary document for running a ceremony.
 */
export const setupCeremony = functions.https.onCall(
    async (data: any, context: functions.https.CallableContext): Promise<any> => {
        if (!context.auth || !context.auth.token.coordinator)
            logMsg(GENERIC_ERRORS.GENERR_NO_COORDINATOR, MsgType.ERROR)

        if (!data.ceremonyInputData || !data.ceremonyPrefix || !data.circuits)
            logMsg(GENERIC_ERRORS.GENERR_MISSING_INPUT, MsgType.ERROR)

        // Database.
        const firestore = admin.firestore()
        const batch = firestore.batch()

        // Get data.
        const { ceremonyInputData, ceremonyPrefix, circuits } = data
        const userId = context.auth?.uid

        // Ceremonies.
        const ceremonyDoc = await firestore.collection(`${collections.ceremonies}/`).doc().get()

        batch.create(ceremonyDoc.ref, {
            title: ceremonyInputData.title,
            description: ceremonyInputData.description,
            startDate: new Date(ceremonyInputData.startDate).valueOf(),
            endDate: new Date(ceremonyInputData.endDate).valueOf(),
            prefix: ceremonyPrefix,
            state: CeremonyState.SCHEDULED,
            type: CeremonyType.PHASE2,
            penalty: ceremonyInputData.penalty,
            timeoutType: ceremonyInputData.timeoutMechanismType,
            coordinatorId: userId,
            lastUpdated: getCurrentServerTimestampInMillis()
        })

        // Circuits.
        if (!circuits.length) logMsg(GENERIC_ERRORS.GENERR_NO_CIRCUIT_PROVIDED, MsgType.ERROR)

        for (const circuit of circuits) {
            const circuitDoc = await firestore
                .collection(`${collections.ceremonies}/${ceremonyDoc.ref.id}/${collections.circuits}`)
                .doc()
                .get()

            batch.create(circuitDoc.ref, {
                ...circuit,
                lastUpdated: getCurrentServerTimestampInMillis()
            })
        }

        await batch.commit()

        logMsg(`Ceremony ${ceremonyDoc.id} setup successfully completed - Coordinator ${userId}`, MsgType.INFO)
    }
)

/**
 * Initialize an empty Waiting Queue field for the newly created circuit document.
 */
export const initEmptyWaitingQueueForCircuit = functions.firestore
    .document(`/${collections.ceremonies}/{ceremony}/${collections.circuits}/{circuit}`)
    .onCreate(async (doc: QueryDocumentSnapshot) => {
        // Get DB.
        const firestore = admin.firestore()

        // Get doc info.
        const circuitId = doc.id
        const circuitData = doc.data()
        const parentCollectionPath = doc.ref.parent.path // == /ceremonies/{ceremony}/circuits/.

        // Empty waiting queue.
        const waitingQueue = {
            contributors: [],
            currentContributor: "",
            completedContributions: 0, // == nextZkeyIndex.
            failedContributions: 0
        }

        // Update the circuit document.
        await firestore
            .collection(parentCollectionPath)
            .doc(circuitId)
            .set(
                {
                    ...circuitData,
                    waitingQueue,
                    lastUpdated: getCurrentServerTimestampInMillis()
                },
                { merge: true }
            )

        logMsg(
            `Empty waiting queue successfully initialized for circuit ${circuitId} - Ceremony ${doc.id}`,
            MsgType.INFO
        )
    })
