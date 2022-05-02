import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { QueryDocumentSnapshot } from "firebase-functions/v1/firestore"
import { Change } from "firebase-functions"
import { zKey } from "snarkjs"
import path from "path"
import os from "os"
import fs from "fs"
import { Timer } from "timer-node"
import blake from "blakejs"
import { ParticipantStatus } from "../types/index.js"

dotenv.config()

// TODO: to be moved to a more general utils.
/**
 * Computes current server timestamp and format it to UTC.
 * @returns <string>
 */
const makeCurrentTimestamp = () => admin.firestore.Timestamp.now().toDate().toUTCString()

/**
 * Format the next zkey index.
 * @param progress <number> - the progression in zkey index (= contributions).
 * @returns <string>
 */
const formatZkeyIndex = (progress: number): string => {
  // TODO: initial zkey index value could be generalized as .env variable.
  const initialZkeyIndex = "00000"

  let index = progress.toString()

  while (index.length < initialZkeyIndex.length) {
    index = `0${index}`
  }

  return index
}

/**
 * Get the document for the circuit of the ceremony with a given sequence position.
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

  if (!circuitDocs) throw new Error(`Oops, seems that there are no circuits for the ceremony`)

  // Filter by position.
  const filteredCircuits = circuitDocs.filter(
    (circuit: admin.firestore.DocumentData) => circuit.data().sequencePosition === position
  )

  if (!filteredCircuits) throw new Error(`Oops, there are no circuits for the ceremony`)

  // Get the circuit (nb. there will be only one circuit w/ that position).
  const circuit = filteredCircuits.at(0)

  if (!circuit) throw new Error(`Oops, seems that circuit with ${position} does not exist`)

  functions.logger.info(`Circuit w/ UID ${circuit.id} at position ${position}`)

  return circuit
}

/**
 * Automate the coordination for participants contributions.
 * @param circuit <QueryDocumentSnapshot> - the circuit document.
 * @param participant <QueryDocumentSnapshot> - the participant document.
 * @param ceremonyId <string> - the ceremony identifier.
 */
const coordinate = async (circuit: QueryDocumentSnapshot, participant: QueryDocumentSnapshot, ceremonyId?: string) => {
  // Get DB.
  const firestore = admin.firestore()
  // Update DB.
  const batch = firestore.batch()

  // Get info.
  const participantId = participant.id
  const circuitData = circuit.data()
  const participantData = participant.data()

  const { waitingQueue } = circuitData
  const { contributors } = waitingQueue
  let { currentContributor, nextContributor, waitingContributors } = waitingQueue
  let newParticipantStatus = 0

  // Case 1: Participant is ready to contribute and there's nobody in the queue.
  if (!contributors.length && !currentContributor) {
    currentContributor = participantId
    newParticipantStatus = ParticipantStatus.CONTRIBUTING
  }

  // Case 3: Participant is ready to contribute but there's another participant currently contributing.
  if (currentContributor !== participantId) {
    newParticipantStatus = ParticipantStatus.WAITING

    // Case 2: Participant is ready to contribute but there's another participant currently contributing.
    if (!nextContributor) nextContributor = participantId
  }

  // Case 4: the participant has finished the contribution so this case is used to update the i circuit queue.
  if (currentContributor === participantId && participantData.status === ParticipantStatus.CONTRIBUTING) {
    contributors.shift(1)
    waitingContributors -= 1

    if (nextContributor) {
      currentContributor = nextContributor
      nextContributor = contributors.length > 1 ? contributors.at(1) : ""

      // Pass the baton to the next participant.
      const newCurrentContributorDoc = await firestore
        .collection(`${ceremonyId}/participants`)
        .doc(currentContributor)
        .get()

      if (newCurrentContributorDoc.exists) {
        batch.update(newCurrentContributorDoc.ref, {
          status: ParticipantStatus.CONTRIBUTING
        })
      }
    } else {
      // There are no next to current contributors.
      currentContributor = ""
    }
  }

  // Updates for cases 1/2/3.
  if (newParticipantStatus !== 0) {
    contributors.push(participantId)
    waitingContributors += 1

    batch.update(participant.ref, {
      status: newParticipantStatus
    })
  }

  // Update waiting queue.
  batch.update(circuit.ref, {
    waitingQueue: {
      ...waitingQueue,
      contributors,
      currentContributor,
      nextContributor,
      waitingContributors
    },
    lastUpdated: makeCurrentTimestamp()
  })

  await batch.commit()
}

/**
 * Make a newly created participant ready to join the waiting queue for contribution.
 */
export const setParticipantReady = functions.firestore
  .document("ceremonies/{ceremonyId}/participants/{participantId}")
  .onCreate(async (snap: QueryDocumentSnapshot) => {
    // Get participant.
    const participantRef = snap.ref
    const participantData = snap.data()

    // Check.
    if (participantData.status !== ParticipantStatus.CREATED) throw new Error(`Status not equal to created`)
    if (participantData.contributionProgress !== 0) throw new Error(`Contribution progress not equal to zero`)

    // Set to ready.
    participantData.status = ParticipantStatus.READY
    participantData.contributionProgress = 1

    await participantRef.set(
      {
        status: participantData.status,
        contributionProgress: participantData.contributionProgress
      },
      { merge: true }
    )

    functions.logger.info(`Participant ${snap.id} ready to join the queue`)
  })

/**
 * Coordinate waiting queue contributors.
 */
export const coordinateContributors = functions.firestore
  .document("ceremonies/{ceremonyId}/participants/{participantId}")
  .onUpdate(async (change: Change<QueryDocumentSnapshot>) => {
    // Before changes.
    const participantBefore = change.before
    const dataBefore = participantBefore.data()
    const { contributionProgress: beforeContributionProgress, status: beforeStatus } = dataBefore

    // After changes.
    const participantAfter = change.after
    const dataAfter = participantAfter.data()
    const { contributionProgress: afterContributionProgress, status: afterStatus } = dataAfter

    // Get the ceremony identifier (this does not change from before/after).
    const ceremonyId = participantBefore.ref.parent.parent!.path

    functions.logger.info(`Ceremony id ${ceremonyId}`)

    if (!ceremonyId) throw new Error(`Oops, we could not find any ceremony identifier`)

    functions.logger.info(
      `Participant ${participantBefore.id} has changed!\nStatus from ${beforeStatus} to ${afterStatus}\nContributionProgress from ${beforeContributionProgress} to ${afterContributionProgress}`
    )

    // nb. existance checked above.
    const circuitsPath = `${participantBefore.ref.parent.parent!.path}/circuits`

    // When a participant changes is status to ready, is "ready" to become a contributor.
    if (afterStatus === ParticipantStatus.READY) {
      if (beforeContributionProgress === 0) {
        functions.logger.info(`Participant ready and before contribution progress ${beforeContributionProgress}`)
        // i -> k where i == 0
        // (participant newly created). We work only on circuit k.
        const circuit = await getCircuitDocumentByPosition(circuitsPath, afterContributionProgress)

        // The circuit info (i.e., the queue) is useful only to check turns for contribution.
        // The participant info is useful to really pass the baton (starting the contribution).
        // So, the info on the circuit says "it's your turn" while the info on the participant says "okay, i'm ready/waiting etc.".
        // The contribution progress number completes everything because indicates which circuit is involved.
        await coordinate(circuit, participantAfter)
      }

      if (afterContributionProgress === beforeContributionProgress + 1 && beforeContributionProgress !== 0) {
        functions.logger.info(
          `Participant ready and afterContribProgress ${afterContributionProgress} is equal to ${beforeContributionProgress} + 1`
        )

        // i -> k where k === i + 1
        // (participant has already contributed to i and the contribution has been verified,
        // participant now is ready to be put in line for contributing on k circuit).
        const beforeCircuit = await getCircuitDocumentByPosition(circuitsPath, beforeContributionProgress)
        const afterCircuit = await getCircuitDocumentByPosition(circuitsPath, afterContributionProgress)

        // Coordinate before circuit (update waiting queue + pass the baton to the next).
        await coordinate(beforeCircuit, participantBefore, ceremonyId)

        // Coordinate after circuit (update waiting queue).
        await coordinate(afterCircuit, participantAfter)
      }
    }

    // Check if the participant has finished to contribute.
    if (afterStatus === ParticipantStatus.CONTRIBUTED) {
      functions.logger.info(`Participant has contributed`)
      // Update the last circuits waiting queue.
      const beforeCircuit = await getCircuitDocumentByPosition(circuitsPath, beforeContributionProgress)

      // Coordinate before circuit (update waiting queue + pass the baton to the next).
      await coordinate(beforeCircuit, participantBefore, ceremonyId)
    }
  })

/**
 * Automate the contribution verification.
 */
export const verifyContribution = functions
  .runWith({
    timeoutSeconds: 540, // TODO: probably should be updated.
    memory: "1GB" // TODO: as above.
  })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
      throw new Error(`The callee is not an authenticated user!`)

    if (!data.ceremonyId || !data.circuitId || !data.contributionTimeInMillis)
      throw new Error(`Missing/Incorrect input data!`)

    // Get DB.
    const firestore = admin.firestore()

    // Get data.
    const { ceremonyId, circuitId, contributionTimeInMillis } = data
    const userId = context.auth.uid

    // Look for documents.
    const ceremonyDoc = await firestore.collection("ceremonies").doc(ceremonyId).get()
    const circuitDoc = await firestore.collection(`ceremonies/${ceremonyId}/circuits`).doc(circuitId).get()
    const participantDoc = await firestore.collection(`ceremonies/${ceremonyId}/participants`).doc(userId).get()

    if (!ceremonyDoc.exists || !circuitDoc.exists || !participantDoc.exists) throw new Error(`Wrong documents!`)

    // Get data from docs.
    const ceremonyData = ceremonyDoc.data()
    const circuitData = circuitDoc.data()
    const participantData = participantDoc.data()

    if (!ceremonyData || !circuitData || !participantData) throw new Error(`Oops, we cannot retrieve documents data!`)

    const verified = false

    if (participantData.status === ParticipantStatus.CONTRIBUTING) {
      // Start the timer.
      const startTime = makeCurrentTimestamp()
      const timer = new Timer({ label: "contributionVerificationTime" })
      timer.start()

      // Get storage paths.
      const ptauStoragePath = `${ceremonyData.prefix}/ptau/${circuitData.ptauFilename}`
      const firstZkeyStoragePath = `${ceremonyData.prefix}/circuits/${circuitData.prefix}/contributions/${circuitData.prefix}_00000.zkey`
      const lastZkeyStoragePath = `${ceremonyData.prefix}/circuits/${circuitData.prefix}/contributions/${
        circuitData.prefix
      }_0000${circuitData.waitingQueue.completedContributions + 1}.zkey`

      // Temporary store files from bucket.
      const lastZkeyIndex = formatZkeyIndex(circuitData.waitingQueue.completedContributions + 1)
      const bucket = admin.storage().bucket()
      const ptauTempFilePath = path.join(os.tmpdir(), `${circuitData.ptauFilename}`)
      const firstZkeyTempFilePath = path.join(os.tmpdir(), `${circuitData.prefix}_00000.zkey`)
      const lastZkeyTempFilePath = path.join(os.tmpdir(), `${circuitData.prefix}_${lastZkeyIndex}.zkey`)

      await bucket.file(ptauStoragePath).download({ destination: ptauTempFilePath })
      await bucket.file(firstZkeyStoragePath).download({ destination: firstZkeyTempFilePath })
      await bucket.file(lastZkeyStoragePath).download({ destination: lastZkeyTempFilePath })

      // Verify contribution.
      const verified = await zKey.verifyFromInit(firstZkeyTempFilePath, ptauTempFilePath, lastZkeyTempFilePath, console)

      // Unlink folders.
      fs.unlinkSync(ptauTempFilePath)
      fs.unlinkSync(firstZkeyTempFilePath)
      fs.unlinkSync(lastZkeyTempFilePath)

      const endTime = makeCurrentTimestamp()

      functions.logger.info(`The contribution is ${verified ? `okay :)` : `not okay :()`}`)

      // Update DB.
      const batch = firestore.batch()

      // Contribution.
      const contributionDoc = await firestore
        .collection(`ceremonies/${ceremonyId}/circuits/${circuitId}/contributions`)
        .doc()
        .get()
      // Reconstruct transcript path.
      const transcriptStoragePath = `${ceremonyData.prefix}/circuits/${circuitData.prefix}/transcripts/${circuitData.prefix}_${lastZkeyIndex}_transcript.log`
      const transcriptTempFilePath = path.join(os.tmpdir(), `${circuitData.prefix}_${lastZkeyIndex}_transcript.log`)
      // Download transcript file.
      await bucket.file(transcriptStoragePath).download({ destination: transcriptTempFilePath })
      // Read file.
      const transcriptBuffer = fs.readFileSync(transcriptTempFilePath)

      // Compute blake2 hash.
      const transcriptBlake2bHash = blake.blake2bHex(transcriptBuffer)

      timer.stop()
      const verificationTime = timer.time()

      batch.create(contributionDoc.ref, {
        participantId: participantDoc.id,
        startTime,
        endTime,
        verificationTime: {
          days: verificationTime.d,
          hours: verificationTime.h,
          minutes: verificationTime.m,
          seconds: verificationTime.s,
          milliseconds: verificationTime.ms
        },
        transcriptPath: transcriptStoragePath,
        transcriptBlake2bHash,
        verified
      })

      // Circuit.
      const { avgContributionTime } = circuitData
      const { completedContributions, failedContributions } = circuitData.waitingQueue

      // Update average contribution time.
      const newAvgContributionTime = (avgContributionTime + contributionTimeInMillis) / 2

      batch.update(circuitDoc.ref, {
        avgContributionTime: verified ? newAvgContributionTime : avgContributionTime,
        waitingQueue: {
          ...circuitData.waitingQueue,
          completedContributions: verified ? completedContributions + 1 : completedContributions,
          failedContributions: verified ? failedContributions : failedContributions + 1
        }
      })

      await batch.commit()

      // TODO: use a logger to create a verification transcript for the contribution.
    }

    functions.logger.info(
      `Participant ${userId} has verified the contribution #${participantData.contributionProgress}`
    )

    return verified
  })

/**
 * Update the participant document after a contribution.
 */
export const refreshParticipantAfterContributionVerification = functions.firestore
  .document(`/ceremonies/{ceremony}/circuits/{circuit}/contributions/{contributions}`)
  .onCreate(async (doc: QueryDocumentSnapshot) => {
    // Get DB.
    const firestore = admin.firestore()

    // Get doc info.
    const contributionId = doc.id
    const contributionData = doc.data()
    const ceremonyCircuitsCollectionPath = doc.ref.parent.parent?.parent?.path // == /ceremonies/{ceremony}/circuits/.
    const ceremonyParticipantsCollectionPath = `${doc.ref.parent.parent?.parent?.parent?.path}/participants` // == /ceremonies/{ceremony}/participants.

    if (!ceremonyCircuitsCollectionPath || !ceremonyParticipantsCollectionPath) throw new Error(`Wrong parent paths`)

    const circuits = await firestore.collection(ceremonyCircuitsCollectionPath).listDocuments()
    const participant = await firestore
      .collection(ceremonyParticipantsCollectionPath)
      .doc(contributionData.participantId)
      .get()
    const participantData = participant.data()

    if (!participantData) throw new Error(`Wrong participant data`)

    const participantContributions = participantData.contributions
    participantContributions.push(contributionId)

    // Update the circuit document.
    await firestore
      .collection(ceremonyParticipantsCollectionPath)
      .doc(contributionData.participantId)
      .set(
        {
          contributionProgress: participantData.contributionProgress + 1,
          status:
            participantData.contributionProgress + 1 > circuits.length
              ? ParticipantStatus.CONTRIBUTED
              : ParticipantStatus.READY,
          contributions: participantContributions
        },
        { merge: true }
      )

    functions.logger.info(
      `Participant ${contributionData.participantId} has been successfully updated after contribution #${participantData.contributionProgress}`
    )
  })
