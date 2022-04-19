import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { QueryDocumentSnapshot } from "firebase-functions/v1/firestore"
import { Change } from "firebase-functions"
import { zKey } from "snarkjs"
import path from "path"
import os from "os"
import fs from "fs"
import { ParticipantStatus } from "../types/index.js"

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
  participantDoc: functions.firestore.QueryDocumentSnapshot,
  ceremonyId: string
): Promise<boolean> => {
  const firestore = admin.firestore()
  // Get.
  const circuitData = circuitDoc.data()
  const circuitId = circuitDoc.id
  // const participantData = participantDoc.data()
  const participantId = participantDoc.id

  // Mirror circuit waiting queue data.
  const { waitingQueue } = circuitData

  // 1. Check if is the first contributor in queue.
  // no contributors, no current contributor.
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
  // at least one contributor, current contributor set, current contrib different from party id, not next contrib.
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
  //  at least one contributor, current contrib set, next contrib set.
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
  // the party id is the current contrib.
  if (waitingQueue.currentContributor === participantId) {
    functions.logger.info(`Participant ${participantId} has finished to contribute for ${circuitId} circuit`)

    /** Waiting queue */
    waitingQueue.contributors.shift(1)
    const { nextContributor } = waitingQueue

    if (nextContributor) {
      // if exists.
      waitingQueue.currentContributor = nextContributor // pass the baton.

      if (!!waitingQueue.contributors && waitingQueue.contributors.length >= 1) {
        waitingQueue.nextContributor = waitingQueue.contributors.at(0)
      }

      const nextParticipantDoc = await firestore.collection(`${ceremonyId}/participants`).doc(nextContributor).get()

      batch.update(nextParticipantDoc.ref, {
        status: ParticipantStatus.CONTRIBUTING
      })
    } else {
      waitingQueue.currentContributor = ""
    }

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

    const ceremonyId = afterParticipantDoc.ref.parent.parent?.path

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
        await updateCircuitWaitingQueueWithParticipant(batch, circuitKDoc, afterParticipantDoc, ceremonyId!)

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
        await updateCircuitWaitingQueueWithParticipant(batch, circuitIDoc, afterParticipantDoc, ceremonyId!)

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
        await updateCircuitWaitingQueueWithParticipant(batch, circuitIDoc, afterParticipantDoc, ceremonyId!)
        await updateCircuitWaitingQueueWithParticipant(batch, circuitKDoc, afterParticipantDoc, ceremonyId!)

        await batch.commit()
      }
    }

    // TODO: handle this corner case.
    // if (beforeContributionProgress === afterContributionProgress)
  })

export const provaBucket = functions.https.onCall(async (data: any) => {
  const ptauStoragePath = `${data.ptauFilename}.ptau`
  const firstZkeyStoragePath = `${data.circuitPrefix}_00000.zkey`
  const lastZkeyStoragePath = `${data.circuitPrefix}_00001.zkey`

  // download.
  // Download file from bucket.
  const bucket = admin.storage().bucket(`gs://mpc-phase2-suite-test.appspot.com`)
  const ptauTempFilePath = path.join(os.tmpdir(), ptauStoragePath)
  const firstZkeyTempFilePath = path.join(os.tmpdir(), firstZkeyStoragePath)
  const lastZkeyTempFilePath = path.join(os.tmpdir(), lastZkeyStoragePath)

  await bucket.file(ptauStoragePath).download({ destination: ptauTempFilePath })
  await bucket.file(firstZkeyStoragePath).download({ destination: firstZkeyTempFilePath })
  await bucket.file(lastZkeyStoragePath).download({ destination: lastZkeyTempFilePath })

  const verified = await zKey.verifyFromInit(firstZkeyTempFilePath, ptauTempFilePath, lastZkeyTempFilePath, console)

  fs.unlinkSync(ptauTempFilePath)
  fs.unlinkSync(firstZkeyTempFilePath)
  fs.unlinkSync(lastZkeyTempFilePath)

  functions.logger.info(`Contribute verified: ${verified}`)
  functions.logger.info(`Data: ${ptauStoragePath} ${firstZkeyStoragePath} ${lastZkeyStoragePath}`)
})

/**
 * tbd.
 * @dev tbd.
 */
export const increaseContributionProgressForParticipant = functions
  .runWith({
    // Ensure the function has enough memory and time
    // to process large files
    timeoutSeconds: 300,
    memory: "2GB"
  })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    // Check if sender is authenticated.
    if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator)) {
      functions.logger.error(`The sender is not an authenticated user!`)
      throw new Error(`The sender is not an authenticated user!`)
    }

    if (!data.ceremonyId) {
      functions.logger.error(`You must provide a ceremony identifier!`)
      throw new Error(`You must provide a ceremony identifier!`)
    }

    if (!data.circuitId) {
      functions.logger.error(`You must provide a circuit identifier!`)
      throw new Error(`You must provide a circuit identifier!`)
    }

    // Get DB.
    const firestore = admin.firestore()

    // Get data.
    const { ceremonyId, circuitId } = data
    const userId = context.auth.uid

    // Look for the ceremony.
    const ceremonyDoc = await firestore.collection("ceremonies").doc(ceremonyId).get()
    // Look for the circuit.
    const circuitDoc = await firestore.collection(`ceremonies/${ceremonyId}/circuits`).doc(circuitId).get()

    // TODO: check if ceremony is running? (could be attacks if checking only client-side?).
    if (!ceremonyDoc.exists) {
      functions.logger.error(`You must provide a valid ceremony identifier!`)
      throw new Error(`You must provide a valid ceremony identifier!`)
    }

    if (!circuitDoc.exists) {
      functions.logger.error(`You must provide a valid circuit identifier!`)
      throw new Error(`You must provide a valid circuit identifier!`)
    }

    // Get data.
    const ceremonyData = ceremonyDoc.data()
    const circuitData = circuitDoc.data()

    if (!ceremonyData) throw new Error(`ops, we cannot retrieve your data!`)
    if (!circuitData) throw new Error(`ops, we cannot retrieve your data!`)

    // Look for the user among ceremony participants.
    const participantDoc = await firestore.collection(`ceremonies/${ceremonyId}/participants`).doc(userId).get()

    if (!participantDoc.exists) throw new Error(`You're not a participant!!!`)

    const participantData = participantDoc.data()

    if (!participantData) throw new Error(`ops, we cannot retrieve your data!`)

    if (participantData.status === ParticipantStatus.CONTRIBUTING) {
      // TODO: check waiting queue / uploaded files, etc.

      // Verify contribution.
      const ptauStoragePath = `${ceremonyData.prefix}/ptau/${circuitData.ptauFilename}.ptau`
      const firstZkeyStoragePath = `${ceremonyData.prefix}/circuits/${circuitData.prefix}/contributions/${circuitData.prefix}_00000.zkey`
      const lastZkeyStoragePath = `${ceremonyData.prefix}/circuits/${circuitData.prefix}/contributions/${
        circuitData.prefix
      }_0000${circuitData.waitingQueue.completedContributions + 1}.zkey`

      // Download file from bucket.
      const bucket = admin.storage().bucket(`gs://mpc-phase2-suite-test.appspot.com`)
      const ptauTempFilePath = path.join(os.tmpdir(), `${circuitData.ptauFilename}.ptau`)
      const firstZkeyTempFilePath = path.join(os.tmpdir(), `${circuitData.prefix}_00000.zkey`)
      const lastZkeyTempFilePath = path.join(
        os.tmpdir(),
        `${circuitData.prefix}_0000${circuitData.waitingQueue.completedContributions + 1}.zkey`
      )

      await bucket.file(ptauStoragePath).download({ destination: ptauTempFilePath })
      await bucket.file(firstZkeyStoragePath).download({ destination: firstZkeyTempFilePath })
      await bucket.file(lastZkeyStoragePath).download({ destination: lastZkeyTempFilePath })

      const verified = await zKey.verifyFromInit(firstZkeyTempFilePath, ptauTempFilePath, lastZkeyTempFilePath, console)

      fs.unlinkSync(ptauTempFilePath)
      fs.unlinkSync(firstZkeyTempFilePath)
      fs.unlinkSync(lastZkeyTempFilePath)

      functions.logger.info(`Contribute verified: ${verified}`)

      const batch = firestore.batch()

      const contributionDoc = await firestore
        .collection(`ceremonies/${ceremonyId}/circuits/${circuitId}/contributions`)
        .doc()
        .get()

      batch.update(participantDoc.ref, {
        status: participantData.contributionProgress > 2 ? ParticipantStatus.CONTRIBUTED : ParticipantStatus.READY,
        contributionProgress: participantData.contributionProgress + 1
      })

      batch.update(circuitDoc.ref, {
        waitingQueue: {
          ...circuitData.waitingQueue,
          completedContributions: verified
            ? circuitData.waitingQueue.completedContributions + 1
            : circuitData.waitingQueue.completedContributions,
          failedContributions: !verified
            ? circuitData.waitingQueue.failedContributions + 1
            : circuitData.waitingQueue.failedContributions,
          waitingContributions: circuitData.waitingQueue.waitingContributions - 1
        }
      })

      batch.create(contributionDoc.ref, {
        participantId: userId
        // TODO: complete with other data.
      })

      // TODO: create a verification transcript for the contribution. (a part must be added to circuit transcript)
      // TODO: use a logger as for the transcript cli side.

      await batch.commit()

      return verified
    }

    functions.logger.info(
      `Participant ${userId} from ${participantData.contributionProgress} to ${
        participantData.contributionProgress + 1
      }`
    )
    return false
  })
