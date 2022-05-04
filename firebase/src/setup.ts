import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { QueryDocumentSnapshot } from "firebase-functions/v1/firestore"
import { getCurrentServerTimestampInMillis } from "./lib/utils.js"

dotenv.config()

/**
 * Initialize an empty Waiting Queue field for the newly created circuit document.
 */
export default functions.firestore
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
