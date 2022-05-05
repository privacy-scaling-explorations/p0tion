import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { QueryDocumentSnapshot } from "firebase-functions/v1/firestore"
import { getCurrentServerTimestampInMillis } from "./lib/utils.js"
import { CeremonyState, CeremonyType } from "../types/index.js"

dotenv.config()

/**
 * Bootstrap/Setup every necessary document for running a ceremony.
 */
export const setupCeremony = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext): Promise<any> => {
    if (!context.auth || !context.auth.token.coordinator)
      throw new Error(`The callee is not an authenticated coordinator!`)

    if (!data.ceremonyInputData || !data.ceremonyPrefix || !data.circuits)
      throw new Error(`Missing/Incorrect input data!`)

    // Get DB.
    const firestore = admin.firestore()
    // Update DB.
    const batch = firestore.batch()

    // Get data.
    const { ceremonyInputData, ceremonyPrefix, circuits } = data
    const userId = context.auth.uid

    // Ceremonies.
    const ceremonyDoc = await firestore.collection(`ceremonies/`).doc().get()

    batch.create(ceremonyDoc.ref, {
      title: ceremonyInputData.title,
      description: ceremonyInputData.description,
      startDate: new Date(ceremonyInputData.startDate).valueOf(),
      endDate: new Date(ceremonyInputData.endDate).valueOf(),
      prefix: ceremonyPrefix,
      state: CeremonyState.SCHEDULED,
      type: CeremonyType.PHASE2,
      coordinatorId: userId,
      lastUpdated: getCurrentServerTimestampInMillis()
    })

    // Circuits.
    if (!circuits.length) throw new Error(`No circuits provided!`)

    for (const circuit of circuits) {
      const circuitDoc = await firestore.collection(`ceremonies/${ceremonyDoc.ref.id}/circuits`).doc().get()

      batch.create(circuitDoc.ref, {
        ...circuit,
        avgContributionTime: circuit.avgContributionTime * 1000,
        lastUpdated: getCurrentServerTimestampInMillis()
      })
    }

    await batch.commit()
  }
)

/**
 * Initialize an empty Waiting Queue field for the newly created circuit document.
 */
export const initEmptyWaitingQueueForCircuit = functions.firestore
  .document(`/ceremonies/{ceremony}/circuits/{circuit}`)
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
      nextContributor: "",
      completedContributions: 0, // == nextZkeyIndex.
      waitingContributors: 0,
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
  })
