import * as functionsV1 from "firebase-functions/v1"
import * as functionsV2 from "firebase-functions/v2"
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
import { FieldValue } from "firebase-admin/firestore"
import { CeremonyState, MsgType, ParticipantContributionStep, ParticipantStatus } from "../types/index.js"
import {
  deleteObject,
  formatZkeyIndex,
  getCircuitDocumentByPosition,
  getCurrentServerTimestampInMillis,
  getS3Client,
  sleep,
  tempDownloadFromBucket,
  uploadFileToBucket
} from "./lib/utils.js"
import { collections, names } from "./lib/constants.js"
import { GENERIC_ERRORS, logMsg } from "./lib/logs.js"

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

  logMsg(`Circuit document ${circuit.id} okay`, MsgType.DEBUG)
  logMsg(`Participant document ${participantId} okay`, MsgType.DEBUG)

  const { waitingQueue } = circuitData
  const { contributors } = waitingQueue
  let { currentContributor } = waitingQueue
  let newParticipantStatus = 0
  let newContributionStep = 0

  // Case 1: Participant is ready to contribute and there's nobody in the queue.
  if (!contributors.length && !currentContributor) {
    logMsg(`Coordination use-case 1: Participant is ready to contribute and there's nobody in the queue`, MsgType.INFO)

    currentContributor = participantId
    newParticipantStatus = ParticipantStatus.CONTRIBUTING
    newContributionStep = ParticipantContributionStep.DOWNLOADING
  }

  // Case 2: Participant is ready to contribute but there's another participant currently contributing.
  if (currentContributor !== participantId) {
    logMsg(
      `Coordination use-case 2: Participant is ready to contribute but there's another participant currently contributing`,
      MsgType.INFO
    )

    newParticipantStatus = ParticipantStatus.WAITING
  }

  // Case 3: the participant has finished the contribution so this case is used to update the i circuit queue.
  if (currentContributor === participantId && participantData.status === ParticipantStatus.CONTRIBUTING) {
    logMsg(
      `Coordination use-case 3: Participant has finished the contribution so this case is used to update the i circuit queue`,
      MsgType.INFO
    )

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
          contributionStep: ParticipantContributionStep.DOWNLOADING,
          contributionStartedAt: getCurrentServerTimestampInMillis(),
          lastUpdated: getCurrentServerTimestampInMillis()
        })

        logMsg(`Batch update use-case 3: New current contributor`, MsgType.INFO)
      }
    } else currentContributor = ""
  }

  // Updates for cases 1 and 2.
  if (newParticipantStatus !== 0) {
    contributors.push(participantId)

    batch.update(participant.ref, {
      status: newParticipantStatus,
      contributionStartedAt:
        newParticipantStatus === ParticipantStatus.CONTRIBUTING ? getCurrentServerTimestampInMillis() : 0,
      lastUpdated: getCurrentServerTimestampInMillis()
    })

    // Case 1 only.
    if (newContributionStep !== 0)
      batch.update(participant.ref, {
        contributionStep: newContributionStep,
        lastUpdated: getCurrentServerTimestampInMillis()
      })

    logMsg(`Batch update use-case 1 or 2: participant updates`, MsgType.INFO)
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

  logMsg(`Batch update all use-cases: update circuit waiting queue`, MsgType.INFO)

  await batch.commit()
}

/**
 * Make a newly created participant ready to join the waiting queue for contribution.
 */
export const setParticipantReady = functionsV1.firestore
  .document(`${collections.ceremonies}/{ceremonyId}/${collections.participants}/{participantId}`)
  .onCreate(async (snap: QueryDocumentSnapshot) => {
    // Get participant.
    const participantRef = snap.ref
    const participantData = snap.data()

    // Check.
    if (participantData.status !== ParticipantStatus.CREATED)
      logMsg(GENERIC_ERRORS.GENERR_INVALID_PARTICIPANT_STATUS, MsgType.ERROR)

    if (participantData.contributionProgress !== 0)
      logMsg(GENERIC_ERRORS.GENERR_INVALID_CONTRIBUTION_PROGRESS, MsgType.ERROR)

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

    logMsg(`Participant ${snap.id} has changed is status to READY`, MsgType.INFO)
  })

/**
 * Coordinate waiting queue contributors.
 */
export const coordinateContributors = functionsV1.firestore
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

    if (!ceremonyId) logMsg(GENERIC_ERRORS.GENERR_NO_CEREMONY_PROVIDED, MsgType.ERROR)

    logMsg(`Coordinating participants for ceremony ${ceremonyId}`, MsgType.INFO)

    logMsg(`Participant document ${participantBefore.id} okay`, MsgType.DEBUG)
    logMsg(`Participant document ${participantAfter.id} okay`, MsgType.DEBUG)
    logMsg(
      `Participant ${participantBefore.id} the status from ${beforeStatus} to ${afterStatus} and the contribution progress from ${beforeContributionProgress} to ${afterContributionProgress}`,
      MsgType.INFO
    )

    // nb. existance checked above.
    const circuitsPath = `${participantBefore.ref.parent.parent!.path}/${collections.circuits}`

    // When a participant changes is status to ready, is "ready" to become a contributor.
    if (afterStatus === ParticipantStatus.READY) {
      // When beforeContributionProgress === 0 is a new participant, when beforeContributionProgress === afterContributionProgress the participant is retrying.
      if (beforeContributionProgress === 0 || beforeContributionProgress === afterContributionProgress) {
        logMsg(
          `Participant has status READY and before contribution progress ${beforeContributionProgress} is different from after contribution progress ${afterContributionProgress}`,
          MsgType.INFO
        )

        // i -> k where i == 0
        // (participant newly created). We work only on circuit k.
        const circuit = await getCircuitDocumentByPosition(circuitsPath, afterContributionProgress)

        logMsg(`Circuit document ${circuit.id} okay`, MsgType.DEBUG)

        // The circuit info (i.e., the queue) is useful only to check turns for contribution.
        // The participant info is useful to really pass the baton (starting the contribution).
        // So, the info on the circuit says "it's your turn" while the info on the participant says "okay, i'm ready/waiting etc.".
        // The contribution progress number completes everything because indicates which circuit is involved.
        await coordinate(circuit, participantAfter)
        logMsg(`Circuit ${circuit.id} has been updated (waiting queue)`, MsgType.INFO)
      }

      if (afterContributionProgress === beforeContributionProgress + 1 && beforeContributionProgress !== 0) {
        logMsg(
          `Participant has status READY and before contribution progress ${beforeContributionProgress} is different from before contribution progress ${afterContributionProgress}`,
          MsgType.INFO
        )

        // i -> k where k === i + 1
        // (participant has already contributed to i and the contribution has been verified,
        // participant now is ready to be put in line for contributing on k circuit).
        const beforeCircuit = await getCircuitDocumentByPosition(circuitsPath, beforeContributionProgress)
        const afterCircuit = await getCircuitDocumentByPosition(circuitsPath, afterContributionProgress)

        logMsg(`Circuit document ${beforeCircuit.id} okay`, MsgType.DEBUG)
        logMsg(`Circuit document ${afterCircuit.id} okay`, MsgType.DEBUG)

        // Coordinate before circuit (update waiting queue + pass the baton to the next).
        await coordinate(beforeCircuit, participantBefore, ceremonyId)
        logMsg(
          `Before circuit ${beforeCircuit.id} has been updated (waiting queue + pass the baton to next)`,
          MsgType.INFO
        )

        // Coordinate after circuit (update waiting queue).
        await coordinate(afterCircuit, participantAfter)
        logMsg(`After circuit ${afterCircuit.id} has been updated (waiting queue)`, MsgType.INFO)
      }
    }

    // Check if the participant has finished to contribute.
    if (afterStatus === ParticipantStatus.CONTRIBUTED && beforeStatus !== ParticipantStatus.CONTRIBUTED) {
      logMsg(`Participant has status CONTRIBUTED`, MsgType.INFO)

      // Update the last circuits waiting queue.
      const beforeCircuit = await getCircuitDocumentByPosition(circuitsPath, beforeContributionProgress)

      logMsg(`Circuit document ${beforeCircuit.id} okay`, MsgType.DEBUG)

      // Coordinate before circuit (update waiting queue + pass the baton to the next).
      await coordinate(beforeCircuit, participantBefore, ceremonyId)
      logMsg(
        `Before circuit ${beforeCircuit.id} has been updated (waiting queue + pass the baton to next)`,
        MsgType.INFO
      )
    }
  })

/**
 * Automate the contribution verification.
 */
export const verifycontribution = functionsV2.https.onCall(
  { memory: "32GiB", cpu: 8, timeoutSeconds: 3600, retry: true, maxInstances: 1000 },
  async (request: functionsV2.https.CallableRequest<any>): Promise<any> => {
    const verifyCloudFunctionTimer = new Timer({ label: "verifyCloudFunction" })
    verifyCloudFunctionTimer.start()

    if (!request.auth || (!request.auth.token.participant && !request.auth.token.coordinator))
      logMsg(GENERIC_ERRORS.GENERR_NO_AUTH_USER_FOUND, MsgType.ERROR)

    if (!request.data.ceremonyId || !request.data.circuitId || !request.data.ghUsername || !request.data.bucketName)
      logMsg(GENERIC_ERRORS.GENERR_MISSING_INPUT, MsgType.ERROR)

    // Get DB.
    const firestore = admin.firestore()

    // Get Storage.
    const S3 = await getS3Client()

    // Get data.
    const { ceremonyId, circuitId, ghUsername, bucketName } = request.data
    const userId = request.auth?.uid

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
      logMsg(GENERIC_ERRORS.GENERR_INVALID_DOCUMENTS, MsgType.ERROR)

    // Get data from docs.
    const ceremonyData = ceremonyDoc.data()
    const circuitData = circuitDoc.data()
    const participantData = participantDoc.data()

    if (!ceremonyData || !circuitData || !participantData) logMsg(GENERIC_ERRORS.GENERR_NO_DATA, MsgType.ERROR)

    logMsg(`Ceremony document ${ceremonyDoc.id} okay`, MsgType.DEBUG)
    logMsg(`Circuit document ${circuitDoc.id} okay`, MsgType.DEBUG)
    logMsg(`Participant document ${participantDoc.id} okay`, MsgType.DEBUG)

    let valid = false
    let verificationComputationTime = 0
    const fullContributionTime = 0

    // Check if is the verification for ceremony finalization.
    const finalize = ceremonyData?.state === CeremonyState.CLOSED && request.auth && request.auth.token.coordinator

    if (participantData?.status === ParticipantStatus.CONTRIBUTING || finalize) {
      // Compute last zkey index.
      const lastZkeyIndex = formatZkeyIndex(circuitData!.waitingQueue.completedContributions + 1)

      // Reconstruct transcript path.
      const transcriptFilename = `${circuitData?.prefix}_${
        finalize
          ? `${ghUsername}_final_verification_transcript.log`
          : `${lastZkeyIndex}_${ghUsername}_verification_transcript.log`
      }`
      const transcriptStoragePath = `${collections.circuits}/${circuitData?.prefix}/${names.transcripts}/${transcriptFilename}`
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
        `${finalize ? `Final verification` : `Verification`} transcript for ${
          circuitData?.prefix
        } circuit Phase 2 contribution.\n${
          finalize ? `Coordinator ` : `Contributor # ${Number(lastZkeyIndex)}`
        } (${ghUsername})\n`
      )

      // Get storage paths.
      const potStoragePath = `${names.pot}/${circuitData?.files.potFilename}`
      const firstZkeyStoragePath = `${collections.circuits}/${circuitData?.prefix}/${collections.contributions}/${circuitData?.prefix}_00000.zkey`
      const lastZkeyStoragePath = `${collections.circuits}/${circuitData?.prefix}/${collections.contributions}/${
        circuitData?.prefix
      }_${finalize ? `final` : lastZkeyIndex}.zkey`

      // Temporary store files from bucket.
      const { potFilename } = circuitData!.files
      const firstZkeyFilename = `${circuitData?.prefix}_00000.zkey`
      const lastZkeyFilename = `${circuitData?.prefix}_${finalize ? `final` : lastZkeyIndex}.zkey`

      const potTempFilePath = path.join(os.tmpdir(), potFilename)
      const firstZkeyTempFilePath = path.join(os.tmpdir(), firstZkeyFilename)
      const lastZkeyTempFilePath = path.join(os.tmpdir(), lastZkeyFilename)

      // Download from AWS S3 bucket.
      await tempDownloadFromBucket(S3, bucketName, potStoragePath, potTempFilePath)
      logMsg(`${potStoragePath} downloaded`, MsgType.DEBUG)

      await tempDownloadFromBucket(S3, bucketName, firstZkeyStoragePath, firstZkeyTempFilePath)
      logMsg(`${firstZkeyStoragePath} downloaded`, MsgType.DEBUG)

      await tempDownloadFromBucket(S3, bucketName, lastZkeyStoragePath, lastZkeyTempFilePath)
      logMsg(`${lastZkeyStoragePath} downloaded`, MsgType.DEBUG)

      logMsg(`Downloads from storage completed`, MsgType.INFO)

      // Verify contribution.
      const verificationComputationTimer = new Timer({ label: "verificationComputation" })
      verificationComputationTimer.start()

      valid = await zKey.verifyFromInit(firstZkeyTempFilePath, potTempFilePath, lastZkeyTempFilePath, transcriptLogger)

      verificationComputationTimer.stop()

      verificationComputationTime = verificationComputationTimer.ms()

      // Compute blake2b hash before unlink.
      const lastZkeyBuffer = fs.readFileSync(lastZkeyTempFilePath)
      const lastZkeyBlake2bHash = blake.blake2bHex(lastZkeyBuffer)

      // Unlink folders.
      fs.unlinkSync(potTempFilePath)
      fs.unlinkSync(firstZkeyTempFilePath)
      fs.unlinkSync(lastZkeyTempFilePath)

      logMsg(`Contribution is ${valid ? `valid` : `invalid`}`, MsgType.INFO)
      logMsg(`Verification computation time ${verificationComputationTime} ms`, MsgType.INFO)

      // Update DB.
      const batch = firestore.batch()

      // Contribution.
      const contributionDoc = await firestore
        .collection(
          `${collections.ceremonies}/${ceremonyId}/${collections.circuits}/${circuitId}/${collections.contributions}`
        )
        .doc()
        .get()

      if (valid) {
        // Sleep ~5 seconds to wait for verification transcription.
        await sleep(5000)

        // Upload transcript (small file - multipart upload not required).
        await uploadFileToBucket(S3, bucketName, transcriptStoragePath, transcriptTempFilePath)

        // Compute blake2b hash.
        const transcriptBuffer = fs.readFileSync(transcriptTempFilePath)
        const transcriptBlake2bHash = blake.blake2bHex(transcriptBuffer)

        fs.unlinkSync(transcriptTempFilePath)

        // Get contribution computation time.
        const contributions = participantData?.contributions.filter(
          (contribution: { hash: string; doc: string; computationTime: number }) =>
            !!contribution.hash && !!contribution.computationTime && !contribution.doc
        )

        if (contributions.length !== 1)
          logMsg(`There should be only one contribution without a doc link`, MsgType.ERROR)

        const contributionComputationTime = contributions[0].computationTime

        // Update only when coordinator is finalizing the ceremony.
        batch.create(contributionDoc.ref, {
          participantId: participantDoc.id,
          contributionComputationTime,
          verificationComputationTime,
          zkeyIndex: finalize ? `final` : lastZkeyIndex,
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

        logMsg(`Batch: create contribution document`, MsgType.DEBUG)

        verifyCloudFunctionTimer.stop()
        const verifyCloudFunctionTime = verifyCloudFunctionTimer.ms()

        if (!finalize) {
          // Circuit.
          const { completedContributions, failedContributions } = circuitData!.waitingQueue
          const {
            contributionComputation: avgContributionComputation,
            fullContribution: avgFullContribution,
            verifyCloudFunction: avgVerifyCloudFunction
          } = circuitData!.avgTimings

          logMsg(`Current average full contribution (down + comp + up) time ${avgFullContribution} ms`, MsgType.INFO)
          logMsg(`Current verify cloud function time ${avgVerifyCloudFunction} ms`, MsgType.INFO)

          // Calculate full contribution time.
          const fullContributionTime = participantData?.verificationStartedAt - participantData?.contributionStartedAt

          // Update avg timings.
          const newAvgContributionComputationTime =
            avgContributionComputation > 0
              ? (avgContributionComputation + contributionComputationTime) / 2
              : contributionComputationTime
          const newAvgFullContributionTime =
            avgFullContribution > 0 ? (avgFullContribution + fullContributionTime) / 2 : fullContributionTime
          const newAvgVerifyCloudFunctionTime =
            avgVerifyCloudFunction > 0
              ? (avgVerifyCloudFunction + verifyCloudFunctionTime) / 2
              : verifyCloudFunctionTime

          logMsg(`New average contribution computation time ${newAvgContributionComputationTime} ms`, MsgType.INFO)
          logMsg(`New average full contribution (down + comp + up) time ${newAvgFullContributionTime} ms`, MsgType.INFO)
          logMsg(`New verify cloud function time ${newAvgVerifyCloudFunctionTime} ms`, MsgType.INFO)

          batch.update(circuitDoc.ref, {
            avgTimings: {
              contributionComputation: valid ? newAvgContributionComputationTime : contributionComputationTime,
              fullContribution: valid ? newAvgFullContributionTime : fullContributionTime,
              verifyCloudFunction: valid ? newAvgVerifyCloudFunctionTime : verifyCloudFunctionTime
            },
            waitingQueue: {
              ...circuitData?.waitingQueue,
              completedContributions: valid ? completedContributions + 1 : completedContributions,
              failedContributions: valid ? failedContributions : failedContributions + 1
            },
            lastUpdated: getCurrentServerTimestampInMillis()
          })
        }

        logMsg(`Batch: update timings and waiting queue for circuit`, MsgType.DEBUG)

        await batch.commit()
      } else {
        // Delete invalid contribution from storage.
        await deleteObject(S3, bucketName, lastZkeyStoragePath)

        // Unlink transcript temp file.
        fs.unlinkSync(transcriptTempFilePath)

        // Create a new contribution doc without files.
        batch.create(contributionDoc.ref, {
          participantId: participantDoc.id,
          verificationComputationTime,
          zkeyIndex: finalize ? `final` : lastZkeyIndex,
          valid,
          lastUpdated: getCurrentServerTimestampInMillis()
        })

        logMsg(`Batch: create invalid contribution document`, MsgType.DEBUG)

        if (!finalize) {
          const { failedContributions } = circuitData!.waitingQueue

          // Update the failed contributions.
          batch.update(circuitDoc.ref, {
            waitingQueue: {
              ...circuitData?.waitingQueue,
              failedContributions: failedContributions + 1
            },
            lastUpdated: getCurrentServerTimestampInMillis()
          })
        }
        logMsg(`Batch: update invalid contributions counter`, MsgType.DEBUG)

        await batch.commit()
      }
    }

    logMsg(
      `Participant ${userId} has verified the contribution #${participantData?.contributionProgress}`,
      MsgType.INFO
    )
    logMsg(`Returned values: valid ${valid} - verificationComputationTime ${verificationComputationTime}`, MsgType.INFO)

    return {
      valid,
      fullContributionTime,
      verifyCloudFunctionTime: verifyCloudFunctionTimer.ms()
    }
  }
)

/**
 * Update the participant document after a contribution.
 */
export const refreshParticipantAfterContributionVerification = functionsV1.firestore
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
      logMsg(GENERIC_ERRORS.GENERR_WRONG_PATHS, MsgType.ERROR)

    // Looks for documents.
    const circuits = await firestore.collection(ceremonyCircuitsCollectionPath!).listDocuments()
    const participantDoc = await firestore
      .collection(ceremonyParticipantsCollectionPath)
      .doc(contributionData.participantId)
      .get()

    if (!participantDoc.exists) logMsg(GENERIC_ERRORS.GENERR_INVALID_DOCUMENTS, MsgType.ERROR)

    // Get data.
    const participantData = participantDoc.data()

    if (!participantData) logMsg(GENERIC_ERRORS.GENERR_NO_DATA, MsgType.ERROR)

    logMsg(`Participant document ${participantDoc.id} okay`, MsgType.DEBUG)

    const participantContributions = participantData?.contributions

    // Update the only one contribution with missing doc (i.e., the last one).
    participantContributions.forEach(
      (participantContribution: { hash: string; doc: string; computationTime: number }) => {
        if (
          !!participantContribution.hash &&
          !!participantContribution.computationTime &&
          !participantContribution.doc
        ) {
          participantContribution.doc = contributionId
        }
      }
    )

    // Don't update the participant status and progress when finalizing.
    if (participantData!.status !== ParticipantStatus.FINALIZING) {
      const newStatus =
        participantData!.contributionProgress + 1 > circuits.length
          ? ParticipantStatus.CONTRIBUTED
          : ParticipantStatus.READY

      await firestore
        .collection(ceremonyParticipantsCollectionPath)
        .doc(contributionData.participantId)
        .set(
          {
            contributionProgress: participantData!.contributionProgress + 1,
            status: newStatus,
            contributionStep: ParticipantContributionStep.COMPLETED,
            contributions: participantContributions,
            tempContributionData: FieldValue.delete(),
            lastUpdated: getCurrentServerTimestampInMillis()
          },
          { merge: true }
        )

      logMsg(`Participant ${contributionData.participantId} updated after contribution`, MsgType.DEBUG)
    } else {
      await firestore.collection(ceremonyParticipantsCollectionPath).doc(contributionData.participantId).set(
        {
          contributions: participantContributions,
          lastUpdated: getCurrentServerTimestampInMillis()
        },
        { merge: true }
      )

      logMsg(`Coordinator ${contributionData.participantId} updated after final contribution`, MsgType.DEBUG)
    }
  })
