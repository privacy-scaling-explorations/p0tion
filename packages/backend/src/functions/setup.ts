import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { QueryDocumentSnapshot } from "firebase-functions/v1/firestore"
import { commonTerms, getCircuitsCollectionPath } from "@zkmpc/actions/src"
import { CeremonyState, CeremonyType } from "@zkmpc/actions/src/types/enums"
import { CircuitWaitingQueue } from "@zkmpc/actions/src/types"
import { LogLevel } from "../../types/enums"
import { COMMON_ERRORS, printLog } from "../lib/errors"
import { getCurrentServerTimestampInMillis } from "../lib/utils"
import { SetupCeremonyData } from "../../types"

dotenv.config()

/**
 * Register all ceremony setup-related documents on the Firestore database.
 * @dev this function will create a new document in the `ceremonies` collection and as needed `circuit`
 * documents in the sub-collection.
 */
export const setupCeremony = functions.https.onCall(
    async (data: SetupCeremonyData, context: functions.https.CallableContext): Promise<any> => {
        // Check if the user has the coordinator claim.
        if (!context.auth || !context.auth.token.coordinator) {
            const error = COMMON_ERRORS.CM_NOT_COORDINATOR_ROLE

            printLog(
                `${error.code}: ${error.message} ${!error.details ? "" : `\ndetails: ${error.details}`}`,
                LogLevel.ERROR
            )
            throw error
        }

        // Validate the provided data.
        if (!data.ceremonyInputData || !data.ceremonyPrefix || !data.circuits.length) {
            const error = COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA

            printLog(
                `${error.code}: ${error.message} ${!error.details ? "" : `\ndetails: ${error.details}`}`,
                LogLevel.ERROR
            )
            throw error
        }

        // Prepare Firestore DB.
        const firestore = admin.firestore()
        const batch = firestore.batch()

        // Prepare data.
        const { ceremonyInputData, ceremonyPrefix, circuits } = data
        const userId = context.auth?.uid

        // Create a new ceremony document.
        const ceremonyDoc = await firestore.collection(`${commonTerms.collections.ceremonies.name}`).doc().get()

        // Prepare tx to write ceremony data.
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

        // Create a new circuit document (circuits ceremony document sub-collection).
        for (const circuit of circuits) {
            // Get a new circuit document.
            const circuitDoc = await firestore.collection(getCircuitsCollectionPath(ceremonyDoc.ref.id)).doc().get()

            // Prepare tx to write circuit data.
            batch.create(circuitDoc.ref, {
                ...circuit,
                lastUpdated: getCurrentServerTimestampInMillis()
            })
        }

        // Send txs in a batch (to avoid race conditions).
        await batch.commit()

        printLog(`Setup completed for ceremony ${ceremonyDoc.id}`, LogLevel.INFO)
    }
)

/**
 * Prepare all the necessary information needed for initializing the waiting queue of a circuit.
 * @dev this function will add a new field `waitingQueue` in the newly created circuit document.
 */
export const initEmptyWaitingQueueForCircuit = functions.firestore
    .document(
        `/${commonTerms.collections.ceremonies.name}/{ceremony}/${commonTerms.collections.circuits.name}/{circuit}`
    )
    .onCreate(async (doc: QueryDocumentSnapshot) => {
        // Prepare Firestore DB.
        const firestore = admin.firestore()

        // Get circuit document identifier and data.
        const circuitId = doc.id
        // Get parent ceremony collection path.
        const parentCollectionPath = doc.ref.parent.path // == /ceremonies/{ceremony}/circuits/.

        // Define an empty waiting queue.
        const emptyWaitingQueue: CircuitWaitingQueue = {
            contributors: [],
            currentContributor: "",
            completedContributions: 0,
            failedContributions: 0
        }

        // Update the circuit document.
        await firestore.collection(parentCollectionPath).doc(circuitId).set(
            {
                waitingQueue: emptyWaitingQueue,
                lastUpdated: getCurrentServerTimestampInMillis()
            },
            { merge: true }
        )

        printLog(
            `An empty waiting queue has been successfully initialized for circuit ${circuitId} which belongs to ceremony ${doc.id}`,
            LogLevel.INFO
        )
    })
