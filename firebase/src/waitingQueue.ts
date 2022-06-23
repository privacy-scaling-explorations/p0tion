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
import winston from "winston"
import { v4 as uuidv4 } from "uuid"
import { ParticipantStatus } from "../types/index.js"
import { formatZkeyIndex, getCircuitDocumentByPosition, getCurrentServerTimestampInMillis } from "./lib/utils.js"
import { collections, names } from "./lib/constants.js"
import { GENERIC_ERRORS, showErrorOrLog } from "./lib/logs.js"

dotenv.config()

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
  let { currentContributor } = waitingQueue
  let newParticipantStatus = 0

  // Case 1: Participant is ready to contribute and there's nobody in the queue.
  if (!contributors.length && !currentContributor) {
    currentContributor = participantId
    newParticipantStatus = ParticipantStatus.CONTRIBUTING
  }

  // Case 2: Participant is ready to contribute but there's another participant currently contributing.
  if (currentContributor !== participantId) newParticipantStatus = ParticipantStatus.WAITING

  // Case 3: the participant has finished the contribution so this case is used to update the i circuit queue.
  if (currentContributor === participantId && participantData.status === ParticipantStatus.CONTRIBUTING) {
    contributors.shift(1)

    if (contributors.length > 0) {
      // There's someone else ready to contribute.
      currentContributor = contributors.at(0)

      // Pass the baton to the next participant.
      const newCurrentContributorDoc = await firestore
        .collection(`${ceremonyId}/${collections.participants}`)
        .doc(currentContributor)
        .get()

      if (newCurrentContributorDoc.exists) {
        batch.update(newCurrentContributorDoc.ref, {
          status: ParticipantStatus.CONTRIBUTING,
          lastUpdated: getCurrentServerTimestampInMillis()
        })
      }
    } else currentContributor = ""
  }

  // Updates for cases 1 and 2.
  if (newParticipantStatus !== 0) {
    contributors.push(participantId)

    batch.update(participant.ref, {
      status: newParticipantStatus,
      lastUpdated: getCurrentServerTimestampInMillis()
    })
  }

  // Update waiting queue.
  batch.update(circuit.ref, {
    waitingQueue: {
      ...waitingQueue,
      contributors,
      currentContributor
    },
    lastUpdated: getCurrentServerTimestampInMillis()
  })

  await batch.commit()
}

/**
 * Make a newly created participant ready to join the waiting queue for contribution.
 */
export const setParticipantReady = functions.firestore
  .document(`${collections.ceremonies}/{ceremonyId}/${collections.participants}/{participantId}`)
  .onCreate(async (snap: QueryDocumentSnapshot) => {
    // Get participant.
    const participantRef = snap.ref
    const participantData = snap.data()

    // Check.
    if (participantData.status !== ParticipantStatus.CREATED)
      showErrorOrLog(GENERIC_ERRORS.GENERR_INVALID_PARTICIPANT_STATUS, true)

    if (participantData.contributionProgress !== 0)
      showErrorOrLog(GENERIC_ERRORS.GENERR_INVALID_CONTRIBUTION_PROGRESS, true)

    // Set to ready.
    participantData.status = ParticipantStatus.READY
    participantData.contributionProgress = 1

    await participantRef.set(
      {
        status: participantData.status,
        contributionProgress: participantData.contributionProgress,
        lastUpdated: getCurrentServerTimestampInMillis()
      },
      { merge: true }
    )

    showErrorOrLog(`Participant ${snap.id} ready to join the queue`, false)
  })

/**
 * Coordinate waiting queue contributors.
 */
export const coordinateContributors = functions.firestore
  .document(`${collections.ceremonies}/{ceremonyId}/${collections.participants}/{participantId}`)
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

    showErrorOrLog(`Ceremony id ${ceremonyId}`, false)

    if (!ceremonyId) showErrorOrLog(GENERIC_ERRORS.GENERR_NO_CEREMONY_PROVIDED, true)

    showErrorOrLog(
      `Participant ${participantBefore.id} has changed!\nStatus from ${beforeStatus} to ${afterStatus}\nContributionProgress from ${beforeContributionProgress} to ${afterContributionProgress}`,
      false
    )

    // nb. existance checked above.
    const circuitsPath = `${participantBefore.ref.parent.parent!.path}/${collections.circuits}`

    // When a participant changes is status to ready, is "ready" to become a contributor.
    if (afterStatus === ParticipantStatus.READY) {
      if (beforeContributionProgress === 0) {
        showErrorOrLog(`Participant ready and before contribution progress ${beforeContributionProgress}`, false)

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
        showErrorOrLog(
          `Participant ready and afterContribProgress ${afterContributionProgress} is equal to ${beforeContributionProgress} + 1`,
          false
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
      showErrorOrLog(`Participant has finished the contributions`, false)

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
    timeoutSeconds: 540,
    memory: "8GB"
  })
  .https.onCall(async (data: any, context: functions.https.CallableContext): Promise<any> => {
    if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
      showErrorOrLog(GENERIC_ERRORS.GENERR_NO_AUTH_USER_FOUND, true)

    if (!data.ceremonyId || !data.circuitId || !data.contributionTimeInMillis || !data.ghUsername)
      showErrorOrLog(GENERIC_ERRORS.GENERR_MISSING_INPUT, true)

    // Get DB.
    const firestore = admin.firestore()

    // Get data.
    const { ceremonyId, circuitId, contributionTimeInMillis, ghUsername } = data
    const userId = context.auth?.uid

    // Look for documents.
    const ceremonyDoc = await firestore.collection(collections.ceremonies).doc(ceremonyId).get()
    const circuitDoc = await firestore
      .collection(`${collections.ceremonies}/${ceremonyId}/${collections.circuits}`)
      .doc(circuitId)
      .get()
    const participantDoc = await firestore
      .collection(`${collections.ceremonies}/${ceremonyId}/${collections.participants}`)
      .doc(userId!)
      .get()

    if (!ceremonyDoc.exists || !circuitDoc.exists || !participantDoc.exists)
      showErrorOrLog(GENERIC_ERRORS.GENERR_INVALID_DOCUMENTS, true)

    // Get data from docs.
    const ceremonyData = ceremonyDoc.data()
    const circuitData = circuitDoc.data()
    const participantData = participantDoc.data()

    if (!ceremonyData || !circuitData || !participantData) showErrorOrLog(GENERIC_ERRORS.GENERR_NO_DATA, true)

    let valid = false
    let verificationTimeInMillis = 0

    if (participantData?.status === ParticipantStatus.CONTRIBUTING) {
      // Compute last zkey index.
      const lastZkeyIndex = formatZkeyIndex(circuitData!.waitingQueue.completedContributions + 1)

      // Reconstruct transcript path.
      const transcriptFilename = `${circuitData?.prefix}_${lastZkeyIndex}_${ghUsername}_verification_transcript.log`
      const transcriptStoragePath = `${ceremonyData?.prefix}/${collections.circuits}/${circuitData?.prefix}/${collections.transcripts}/${transcriptFilename}`
      const transcriptTempFilePath = path.join(os.tmpdir(), transcriptFilename)

      // Custom logger for verification transcript.
      const transcriptLogger = winston.createLogger({
        level: "info",
        format: winston.format.printf((log) => log.message),
        transports: [
          // Write all logs with importance level of `info` to `transcript.json`.
          new winston.transports.File({
            filename: transcriptTempFilePath,
            level: "info"
          })
        ]
      })

      transcriptLogger.info(
        `Verification transcript for ${circuitData?.prefix} circuit Phase 2 contribution.\nContributor # ${Number(
          lastZkeyIndex
        )} (${ghUsername})\n`
      )

      // Start the timer.
      const timer = new Timer({ label: "contributionVerificationTime" })
      timer.start()

      // Get storage paths.
      const potStoragePath = `${ceremonyData?.prefix}/${names.pot}/${circuitData?.files.potFilename}`
      const firstZkeyStoragePath = `${ceremonyData?.prefix}/${collections.circuits}/${circuitData?.prefix}/${collections.contributions}/${circuitData?.prefix}_00000.zkey`
      const lastZkeyStoragePath = `${ceremonyData?.prefix}/${collections.circuits}/${circuitData?.prefix}/${collections.contributions}/${circuitData?.prefix}_${lastZkeyIndex}.zkey`

      // Temporary store files from bucket.
      const bucket = admin.storage().bucket()

      const { potFilename } = circuitData!.files
      const firstZkeyFilename = `${circuitData?.prefix}_00000.zkey`
      const lastZkeyFilename = `${circuitData?.prefix}_${lastZkeyIndex}.zkey`

      const potTempFilePath = path.join(os.tmpdir(), potFilename)
      const firstZkeyTempFilePath = path.join(os.tmpdir(), firstZkeyFilename)
      const lastZkeyTempFilePath = path.join(os.tmpdir(), lastZkeyFilename)

      await bucket.file(potStoragePath).download({ destination: potTempFilePath })
      await bucket.file(firstZkeyStoragePath).download({ destination: firstZkeyTempFilePath })
      await bucket.file(lastZkeyStoragePath).download({ destination: lastZkeyTempFilePath })

      // Verify contribution.
      valid = await zKey.verifyFromInit(firstZkeyTempFilePath, potTempFilePath, lastZkeyTempFilePath, transcriptLogger)

      // Compute blake2b hash before unlink.
      const lastZkeyBuffer = fs.readFileSync(lastZkeyTempFilePath)
      const lastZkeyBlake2bHash = blake.blake2bHex(lastZkeyBuffer)

      // Unlink folders.
      fs.unlinkSync(potTempFilePath)
      fs.unlinkSync(firstZkeyTempFilePath)
      fs.unlinkSync(lastZkeyTempFilePath)

      showErrorOrLog(`The contribution has been evaluated as ${valid ? `valid` : `invalid`}`, false)

      timer.stop()
      verificationTimeInMillis = timer.ms()

      // Upload transcript.
      const [file] = await bucket.upload(transcriptTempFilePath, {
        destination: transcriptStoragePath,
        metadata: {
          contentType: "text/plain",
          metadata: {
            firebaseStorageDownloadTokens: uuidv4()
          }
        }
      })

      showErrorOrLog(`Verification transcript ${file.name} successfully stored`, false)

      // Update DB.
      const batch = firestore.batch()

      // Contribution.
      const contributionDoc = await firestore
        .collection(
          `${collections.ceremonies}/${ceremonyId}/${collections.circuits}/${circuitId}/${collections.contributions}`
        )
        .doc()
        .get()

      // Compute blake2b hash.
      const transcriptBuffer = fs.readFileSync(transcriptTempFilePath)
      const transcriptBlake2bHash = blake.blake2bHex(transcriptBuffer)

      fs.unlinkSync(transcriptTempFilePath)

      batch.create(contributionDoc.ref, {
        participantId: participantDoc.id,
        contributionTime: contributionTimeInMillis,
        verificationTime: verificationTimeInMillis,
        zkeyIndex: lastZkeyIndex,
        files: {
          transcriptFilename,
          lastZkeyFilename,
          transcriptStoragePath,
          lastZkeyStoragePath,
          transcriptBlake2bHash,
          lastZkeyBlake2bHash
        },
        valid,
        lastUpdated: getCurrentServerTimestampInMillis()
      })

      // Circuit.
      const { completedContributions, failedContributions } = circuitData!.waitingQueue
      const { avgContributionTime, avgVerificationTime } = circuitData!.avgTimings

      // Update avg timings.
      const newAvgContributionTime =
        avgContributionTime > 0 ? (avgContributionTime + contributionTimeInMillis) / 2 : contributionTimeInMillis
      const newAvgVerificationTime =
        avgVerificationTime > 0 ? (avgVerificationTime + verificationTimeInMillis) / 2 : verificationTimeInMillis

      batch.update(circuitDoc.ref, {
        avgTimings: {
          avgContributionTime: valid ? newAvgContributionTime : avgContributionTime,
          avgVerificationTime: valid ? newAvgVerificationTime : avgVerificationTime
        },
        waitingQueue: {
          ...circuitData?.waitingQueue,
          completedContributions: valid ? completedContributions + 1 : completedContributions,
          failedContributions: valid ? failedContributions : failedContributions + 1
        },
        lastUpdated: getCurrentServerTimestampInMillis()
      })

      await batch.commit()
    }

    showErrorOrLog(
      `Participant ${userId} has verified the contribution #${participantData?.contributionProgress}`,
      false
    )

    return {
      valid,
      verificationTimeInMillis
    }
  })

/**
 * Update the participant document after a contribution.
 */
export const refreshParticipantAfterContributionVerification = functions.firestore
  .document(
    `/${collections.ceremonies}/{ceremony}/${collections.circuits}/{circuit}/${collections.contributions}/{contributions}`
  )
  .onCreate(async (doc: QueryDocumentSnapshot) => {
    // Get DB.
    const firestore = admin.firestore()

    // Get doc info.
    const contributionId = doc.id
    const contributionData = doc.data()
    const ceremonyCircuitsCollectionPath = doc.ref.parent.parent?.parent?.path // == /ceremonies/{ceremony}/circuits/.
    const ceremonyParticipantsCollectionPath = `${doc.ref.parent.parent?.parent?.parent?.path}/${collections.participants}` // == /ceremonies/{ceremony}/participants.

    if (!ceremonyCircuitsCollectionPath || !ceremonyParticipantsCollectionPath)
      showErrorOrLog(GENERIC_ERRORS.GENERR_WRONG_PATHS, true)

    const circuits = await firestore.collection(ceremonyCircuitsCollectionPath!).listDocuments()
    const participant = await firestore
      .collection(ceremonyParticipantsCollectionPath)
      .doc(contributionData.participantId)
      .get()
    const participantData = participant.data()

    if (!participantData) showErrorOrLog(GENERIC_ERRORS.GENERR_NO_DATA, true)

    const participantContributions = participantData?.contributions
    participantContributions.push(contributionId)

    // Update the circuit document.
    await firestore
      .collection(ceremonyParticipantsCollectionPath)
      .doc(contributionData.participantId)
      .set(
        {
          contributionProgress: participantData!.contributionProgress + 1,
          status:
            participantData!.contributionProgress + 1 > circuits.length
              ? ParticipantStatus.CONTRIBUTED
              : ParticipantStatus.READY,
          contributions: participantContributions,
          lastUpdated: getCurrentServerTimestampInMillis()
        },
        { merge: true }
      )

    showErrorOrLog(
      `Participant ${contributionData.participantId} has been successfully updated after contribution #${participantData?.contributionProgress}`,
      false
    )
  })
