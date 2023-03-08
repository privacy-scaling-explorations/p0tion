import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { DocumentSnapshot, QueryDocumentSnapshot } from "firebase-functions/v1/firestore"
import { CeremonyState, ParticipantStatus, CeremonyType } from "@zkmpc/actions/src/types/enums"
import { CircuitWaitingQueue } from "@zkmpc/actions/src/types"
import { commonTerms, getCircuitsCollectionPath, getParticipantsCollectionPath } from "@zkmpc/actions/src"
import { SetupCeremonyData } from "../../types"
import { COMMON_ERRORS, logAndThrowError, printLog, SPECIFIC_ERRORS } from "../lib/errors"
import {
    queryCeremoniesByStateAndDate,
    getCurrentServerTimestampInMillis,
    getDocumentById,
    getCeremonyCircuits,
    getFinalContribution
} from "../lib/utils"
import { LogLevel } from "../../types/enums"

dotenv.config()

/**
 * Make a scheduled ceremony open.
 * @dev this function automatically runs every 30 minutes.
 * @todo this methodology for transitioning a ceremony from `scheduled` to `opened` state will be replaced with one
 * that resolves the issues presented in the issue #192 (https://github.com/quadratic-funding/mpc-phase2-suite/issues/192).
 */
export const startCeremony = functions.pubsub.schedule(`every 30 minutes`).onRun(async () => {
    // Get ready to be opened ceremonies.
    const scheduledCeremoniesQuerySnap = await queryCeremoniesByStateAndDate(CeremonyState.SCHEDULED, true, "<=")

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
 * that resolves the issues presented in the issue #192 (https://github.com/quadratic-funding/mpc-phase2-suite/issues/192).
 */
export const stopCeremony = functions.pubsub.schedule(`every 30 minutes`).onRun(async () => {
    // Get opened ceremonies.
    const runningCeremoniesQuerySnap = await queryCeremoniesByStateAndDate(CeremonyState.OPENED, false, "<=")

    if (!runningCeremoniesQuerySnap.empty) {
        runningCeremoniesQuerySnap.forEach(async (ceremonyDoc: DocumentSnapshot) => {
            // Make state transition to close ceremony.
            await ceremonyDoc.ref.set({ state: CeremonyState.CLOSED }, { merge: true })

            printLog(`Ceremony ${ceremonyDoc.id} is now closed`, LogLevel.DEBUG)
        })
    }
})

/**
 * Register all ceremony setup-related documents on the Firestore database.
 * @dev this function will create a new document in the `ceremonies` collection and as needed `circuit`
 * documents in the sub-collection.
 */
export const setupCeremony = functions.https.onCall(
    async (data: SetupCeremonyData, context: functions.https.CallableContext): Promise<any> => {
        // Check if the user has the coordinator claim.
        if (!context.auth || !context.auth.token.coordinator) logAndThrowError(COMMON_ERRORS.CM_NOT_COORDINATOR_ROLE)

        // Validate the provided data.
        if (!data.ceremonyInputData || !data.ceremonyPrefix || !data.circuits.length)
            logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

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

        printLog(`Setup completed for ceremony ${ceremonyDoc.id}`, LogLevel.DEBUG)

        return ceremonyDoc.id
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
            LogLevel.DEBUG
        )
    })

/**
 * Conclude the finalization of the ceremony.
 * @dev checks that the ceremony is closed (= CLOSED), the coordinator is finalizing and has already
 * provided the final contribution for each ceremony circuit.
 */
export const finalizeCeremony = functions.https.onCall(
    async (data: { ceremonyId: string }, context: functions.https.CallableContext): Promise<any> => {
        if (!context.auth || !context.auth.token.coordinator) logAndThrowError(COMMON_ERRORS.CM_NOT_COORDINATOR_ROLE)

        if (!data.ceremonyId) logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Prepare Firestore DB.
        const firestore = admin.firestore()
        const batch = firestore.batch()

        // Extract data.
        const { ceremonyId } = data
        const userId = context.auth?.uid

        // Look for the ceremony document.
        const ceremonyDoc = await getDocumentById(commonTerms.collections.ceremonies.name, ceremonyId)
        const participantDoc = await getDocumentById(getParticipantsCollectionPath(ceremonyId), userId!)

        if (!ceremonyDoc.data() || !participantDoc.data()) logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

        // Get ceremony circuits.
        const circuits = await getCeremonyCircuits(ceremonyId)

        // Get final contribution for each circuit.
        // nb. the `getFinalContributionDocument` checks the existance of the final contribution document (if not present, throws).
        // Therefore, we just need to call the method without taking any data to verify the pre-condition of having already computed
        // the final contributions for each ceremony circuit.
        for await (const circuit of circuits) await getFinalContribution(ceremonyId, circuit.id)

        // Extract data.
        const { state } = ceremonyDoc.data()!
        const { status } = participantDoc.data()!

        // Pre-conditions: verify the ceremony is closed and coordinator is finalizing.
        if (state === CeremonyState.CLOSED && status === ParticipantStatus.FINALIZING) {
            // Prepare txs for updates.
            batch.update(ceremonyDoc.ref, { state: CeremonyState.FINALIZED })
            batch.update(participantDoc.ref, {
                status: ParticipantStatus.FINALIZED
            })

            await batch.commit()

            printLog(`Ceremony ${ceremonyDoc.id} correctly finalized - Coordinator ${participantDoc.id}`, LogLevel.INFO)
        } else logAndThrowError(SPECIFIC_ERRORS.SE_CEREMONY_CANNOT_FINALIZE_CEREMONY)
    }
)
