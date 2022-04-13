import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { DocumentSnapshot, QueryDocumentSnapshot } from "firebase-functions/v1/firestore"
import { Change } from "firebase-functions"
import { CeremonyState, ParticipantStatus } from "../types/index.js"

dotenv.config()

/**
 * tbd
 * @param batch tbd
 * @param circuitDoc tbd
 * @param participantDoc tbd
 */
const updateCircuitWaitingQueueWithParticipant = async (
  batch: admin.firestore.WriteBatch,
  circuitDoc: functions.firestore.QueryDocumentSnapshot,
  participantDoc: functions.firestore.QueryDocumentSnapshot
): Promise<boolean> => {
  // Get.
  const circuitData = circuitDoc.data()
  const circuitId = circuitDoc.id
  // const participantData = participantDoc.data()
  const participantId = participantDoc.id

  // Mirror circuit waiting queue data.
  const { waitingQueue } = circuitData

  // 1. Check if is the first contributor in queue.
  if (!waitingQueue.contributors.length && !waitingQueue.currentContributor) {
    functions.logger.info(`Participant ${participantId} is the first contributor in queue for circuit ${circuitId}`)

    /** Waiting queue */

    waitingQueue.contributors.push(participantId)
    waitingQueue.waitingContributions += 1
    waitingQueue.currentContributor = participantId // auto-pass the baton.

    batch.update(circuitDoc.ref, {
      waitingQueue: {
        ...circuitData.waitingQueue,
        lastUpdated: admin.firestore.Timestamp.now().toDate().toUTCString()
      }
    })

    batch.update(participantDoc.ref, {
      status: ParticipantStatus.CONTRIBUTING
    })

    functions.logger.info(`Waiting queue for circuit ${circuitId} updated!`)
    return true
  }

  // 2. Check if is the next contributor in queue.
  if (
    waitingQueue.contributors.length >= 1 &&
    waitingQueue.currentContributor.length > 0 &&
    waitingQueue.currentContributor !== participantId &&
    !waitingQueue.nextContributor
  ) {
    functions.logger.info(`Participant ${participantId} is the next contributor in queue for circuit ${circuitId}`)

    /** Waiting queue */

    waitingQueue.contributors.push(participantId)
    waitingQueue.waitingContributions += 1
    waitingQueue.nextContributor = participantId

    batch.update(circuitDoc.ref, {
      waitingQueue: {
        ...circuitData.waitingQueue,
        lastUpdated: admin.firestore.Timestamp.now().toDate().toUTCString()
      }
    })

    // TODO: think about NEXT?
    batch.update(participantDoc.ref, {
      status: ParticipantStatus.WAITING
    })

    functions.logger.info(`Waiting queue for circuit ${circuitId} updated!`)

    return true
  }

  // 3. Put in the queue.
  if (
    waitingQueue.contributors.length >= 1 &&
    waitingQueue.currentContributor.length > 0 &&
    waitingQueue.nextContributor.length > 0
  ) {
    functions.logger.info(`Participant ${participantId} in queue for circuit ${circuitId}`)

    /** Waiting queue */

    waitingQueue.contributors.push(participantId)
    waitingQueue.waitingContributions += 1

    batch.update(circuitDoc.ref, {
      waitingQueue: {
        ...circuitData.waitingQueue,
        lastUpdated: admin.firestore.Timestamp.now().toDate().toUTCString()
      }
    })

    batch.update(participantDoc.ref, {
      status: ParticipantStatus.WAITING
    })

    functions.logger.info(`Waiting queue for circuit ${circuitId} updated!`)

    return true
  }

  // 4. Check if is the current contributor (finished contribution).
  if (waitingQueue.currentContributor === participantId) {
    functions.logger.info(`Participant ${participantId} has finished to contribute for ${circuitId} circuit`)

    /** Waiting queue */

    waitingQueue.contributors.shift(1)
    waitingQueue.waitingContributions -= 1
    waitingQueue.currentContributor = waitingQueue.nextContributor // pass the baton.

    if (waitingQueue.contributors.length >= 1) waitingQueue.nextContributor = waitingQueue.contributors.at(0)

    batch.update(circuitDoc.ref, {
      waitingQueue: {
        ...circuitData.waitingQueue,
        lastUpdated: admin.firestore.Timestamp.now().toDate().toUTCString()
      }
    })

    functions.logger.info(`Waiting queue for circuit ${circuitId} updated!`)
    return true
  }

  return false
}

/**
 * Return the document for the circuit of the ceremony with a given sequence position.
 * @param circuitsPath <string> - the collection path from ceremonies to circuits.
 * @param position <number> - the sequence position of the circuit.
 * @returns Promise<admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>>
 */
const getCircuitDocumentByPosition = async (
  circuitsPath: string,
  position: number
): Promise<admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>> => {
  // Get DB.
  const firestore = admin.firestore()

  // Query for all docs.
  const circuitsQuerySnap = await firestore.collection(circuitsPath).get()
  const circuitDocs = circuitsQuerySnap.docs

  if (!circuitDocs) throw new Error(`no circuits :'(`)

  // Filter by position.
  const filteredCircuits = circuitDocs.filter(
    (circuit: admin.firestore.DocumentData) => circuit.data().sequencePosition === position
  )

  // There should be only one circuit with a given position.
  const circuit = filteredCircuits[0]

  if (!circuit.exists) throw new Error(`oops, no or more than one circuit found for pos X in ceremony Y!`)

  functions.logger.info(`Circuit ${position} w/ UID ${circuit.id}`)

  return circuit
}

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

/**
 * Initialize an empty Waiting Queue field for the specific circuit document.
 */
export const initWaitingQueueForCircuit = functions.firestore
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
      lastContributor: "",
      nextContributor: "",
      completedContributions: 0, // == nextZkeyIndex.
      waitingContributions: 0,
      failedContributions: 0,
      lastUpdated: admin.firestore.Timestamp.now().toDate().toUTCString()
    }

    // Update the circuit document.
    await firestore
      .collection(parentCollectionPath)
      .doc(circuitId)
      .set(
        {
          ...circuitData,
          waitingQueue
        },
        { merge: true }
      )
  })

/**
 * Manage the ceremony participation logic for each authenticated user who request to participate to a provided ceremony.
 * @dev works on Participants collection for `contribute` CLI command.
 */
export const manageCeremonyParticipant = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    // Check if sender is authenticated.
    if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator)) {
      functions.logger.error(`The sender is not an authenticated user!`)
      throw new Error(`The sender is not an authenticated user!`)
    }

    if (!data.ceremonyId) {
      functions.logger.error(`You must provide a ceremony identifier!`)
      throw new Error(`You must provide a ceremony identifier!`)
    }

    // Get DB.
    const firestore = admin.firestore()

    // Get data.
    const { ceremonyId } = data
    const userId = context.auth.uid

    // Look for the ceremony.
    const ceremonyDoc = await firestore.collection("ceremonies").doc(ceremonyId).get()

    // TODO: check if ceremony is running? (could be attacks if checking only client-side?).
    if (!ceremonyDoc.exists) {
      functions.logger.error(`You must provide a valid ceremony identifier!`)
      throw new Error(`You must provide a valid ceremony identifier!`)
    }

    // Look for the user among ceremony participants.
    const participantDoc = await firestore.collection(`ceremonies/${ceremonyId}/participants`).doc(userId).get()

    if (!participantDoc.exists) {
      // Create a new Participant doc for the sender.
      await participantDoc.ref.set({
        status: ParticipantStatus.WAITING,
        contributionProgress: 0,
        contributions: []
      })

      functions.logger.info(`Participant document with UID ${userId} has been successfully created`)
    } else {
      functions.logger.info(`Participant document with UID ${userId} already exists`)
    }
  }
)

/**
 * Set a newly created participant ready.
 * @dev this helps for preparing the participant for the next queue management.
 */
export const setParticipantReady = functions.firestore
  .document("ceremonies/{ceremonyId}/participants/{participantId}")
  .onCreate(async (snap: QueryDocumentSnapshot) => {
    // Get.
    const participantRef = snap.ref
    const participantData = snap.data()

    // Check.
    if (participantData.status !== ParticipantStatus.WAITING) throw new Error(`not waiting`)
    if (participantData.contributionProgress !== 0) throw new Error(`not def contrib progress`)

    // Update.
    participantData.status = ParticipantStatus.READY
    participantData.contributionProgress = 1

    await participantRef.set(
      {
        ...participantData
      },
      { merge: true }
    )

    functions.logger.info(`Participant ${snap.id} ready`)
  })

/**
 * Manages the contribution progress for each circuit by a participant.
 * @dev also manages the contribution queuing, verification and update process.
 */
export const manageParticipantContributionProgress = functions.firestore
  .document("ceremonies/{ceremonyId}/participants/{participantId}")
  .onUpdate(async (change: Change<QueryDocumentSnapshot>) => {
    // Get before info.
    const beforeParticipantDoc = change.before
    const beforeParticipantData = beforeParticipantDoc.data()
    const beforeContributionProgress = beforeParticipantData.contributionProgress
    const beforeStatus = beforeParticipantData.status

    // Get after info.
    const afterParticipantDoc = change.after
    const afterParticipantData = afterParticipantDoc.data()
    const afterContributionProgress = afterParticipantData.contributionProgress
    const afterStatus = afterParticipantData.status

    // Common info.
    if (beforeParticipantDoc.id !== afterParticipantDoc.id) throw new Error(`mismatching party id`)

    const participantId = beforeParticipantDoc.id
    if (!beforeParticipantDoc.ref.path.includes(`ceremonies/`)) throw new Error(`wrong path for doc`)

    // existence check above.
    const circuitsPath = `${beforeParticipantDoc.ref.parent.parent!.path}/circuits`

    functions.logger.info(
      `Participant ${participantId} progress: ${beforeContributionProgress} -> ${afterContributionProgress}`
    )

    // Get DB.
    const firestore = admin.firestore()
    const batch = firestore.batch()

    if (beforeStatus !== afterStatus && afterStatus === ParticipantStatus.READY) {
      // i -> k where i == 0. We work only on circuit k.
      if (beforeContributionProgress === 0 && afterContributionProgress === 1) {
        // nb. here we work only on circuit w/ position k (should be 1 === beforeContributionProgress).
        // Thus, we do not need any contribution verification as it's the first circuit and there are no contributions yet made by the participant.

        // Get document data for circuit k.
        const circuitKDoc = await getCircuitDocumentByPosition(circuitsPath, afterContributionProgress)

        // Update k waiting queue.
        await updateCircuitWaitingQueueWithParticipant(batch, circuitKDoc, afterParticipantDoc)

        if (afterContributionProgress === 3)
          batch.update(afterParticipantDoc.ref, {
            status: ParticipantStatus.CONTRIBUTED
          })

        await batch.commit()
      }

      // MOCK
      const numberOfCircuits = 2

      // TODO: read real values from db.
      if (beforeContributionProgress === numberOfCircuits && afterContributionProgress === numberOfCircuits + 1) {
        // Get document data for circuit k.
        const circuitIDoc = await getCircuitDocumentByPosition(circuitsPath, beforeContributionProgress)

        // Update k waiting queue.
        await updateCircuitWaitingQueueWithParticipant(batch, circuitIDoc, afterParticipantDoc)

        batch.update(afterParticipantDoc.ref, {
          status: ParticipantStatus.CONTRIBUTED
        })

        await batch.commit()
      }

      if (beforeContributionProgress > 0 && afterContributionProgress > 1) {
        // i -> k where i != 0. We work both on circuit i and k.
        functions.logger.info(
          `From circuit ${beforeParticipantData.contributionProgress} to ${afterParticipantData.contributionProgress}`
        )

        // TODO: Verify contribution.

        // Get circuits.
        const circuitIDoc = await getCircuitDocumentByPosition(circuitsPath, beforeContributionProgress)
        const circuitKDoc = await getCircuitDocumentByPosition(circuitsPath, afterContributionProgress)

        // Update i waiting queue (pass the baton).
        await updateCircuitWaitingQueueWithParticipant(batch, circuitIDoc, afterParticipantDoc)
        await updateCircuitWaitingQueueWithParticipant(batch, circuitKDoc, afterParticipantDoc)

        await batch.commit()
      }
    }

    // TODO: handle this corner case.
    // if (beforeContributionProgress === afterContributionProgress)
  })

/**
 * tbd.
 * @dev tbd.
 */
export const increaseContributionProgressForParticipant = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    // Check if sender is authenticated.
    if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator)) {
      functions.logger.error(`The sender is not an authenticated user!`)
      throw new Error(`The sender is not an authenticated user!`)
    }

    if (!data.ceremonyId) {
      functions.logger.error(`You must provide a ceremony identifier!`)
      throw new Error(`You must provide a ceremony identifier!`)
    }

    // Get DB.
    const firestore = admin.firestore()

    // Get data.
    const { ceremonyId } = data
    const userId = context.auth.uid

    // Look for the ceremony.
    const ceremonyDoc = await firestore.collection("ceremonies").doc(ceremonyId).get()

    // TODO: check if ceremony is running? (could be attacks if checking only client-side?).
    if (!ceremonyDoc.exists) {
      functions.logger.error(`You must provide a valid ceremony identifier!`)
      throw new Error(`You must provide a valid ceremony identifier!`)
    }

    // Look for the user among ceremony participants.
    const participantDoc = await firestore.collection(`ceremonies/${ceremonyId}/participants`).doc(userId).get()

    if (!participantDoc.exists) throw new Error(`You're not a participant!!!`)

    const participantData = participantDoc.data()

    if (!participantData) throw new Error(`ops, we cannot retrieve your data!`)

    if (participantData.status === ParticipantStatus.CONTRIBUTING) {
      // TODO: check waiting queue / uploaded files, etc.

      // TODO: create a contribution doc here?

      // Update contribution progress.
      await participantDoc.ref.set(
        {
          status: participantData.contributionProgress > 2 ? ParticipantStatus.CONTRIBUTED : ParticipantStatus.READY,
          contributionProgress: participantData.contributionProgress + 1
        },
        { merge: true }
      )
    }

    functions.logger.info(
      `Participant ${userId} from ${participantData.contributionProgress} to ${
        participantData.contributionProgress + 1
      }`
    )
  }
)
