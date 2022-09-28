import * as functions from "firebase-functions"
import admin from "firebase-admin"
import path from "path"
import os from "os"
import fs from "fs"
import blake from "blakejs"
import { logMsg, GENERIC_ERRORS } from "./lib/logs.js"
import { collections } from "./lib/constants.js"
import { CeremonyState, MsgType, ParticipantStatus } from "../types/index.js"
import {
  getCeremonyCircuits,
  getCurrentServerTimestampInMillis,
  getFinalContributionDocument,
  getS3Client,
  tempDownloadFromBucket
} from "./lib/utils.js"

/**
 * Check and prepare the coordinator for the ceremony finalization.
 */
export const checkAndPrepareCoordinatorForFinalization = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    // Check if sender is authenticated.
    if (!context.auth || !context.auth.token.coordinator)
      logMsg(GENERIC_ERRORS.GENERR_NO_AUTH_USER_FOUND, MsgType.ERROR)

    if (!data.ceremonyId) logMsg(GENERIC_ERRORS.GENERR_NO_CEREMONY_PROVIDED, MsgType.ERROR)

    // Get DB.
    const firestore = admin.firestore()

    // Get data.
    const { ceremonyId } = data
    const userId = context.auth?.uid

    // Look for the ceremony.
    const ceremonyDoc = await firestore.collection(collections.ceremonies).doc(ceremonyId).get()

    // Check existence.
    if (!ceremonyDoc.exists) logMsg(GENERIC_ERRORS.GENERR_INVALID_CEREMONY, MsgType.ERROR)

    // Get ceremony data.
    const ceremonyData = ceremonyDoc.data()

    // Check if running.
    if (!ceremonyData || ceremonyData.state !== CeremonyState.CLOSED)
      logMsg(GENERIC_ERRORS.GENERR_CEREMONY_NOT_CLOSED, MsgType.ERROR)

    // Look for the coordinator among ceremony participant.
    const participantDoc = await firestore
      .collection(`${collections.ceremonies}/${ceremonyId}/${collections.participants}`)
      .doc(userId!)
      .get()

    // Check if the coordinator has completed the contributions for all circuits.
    const participantData = participantDoc.data()

    if (!participantData) logMsg(GENERIC_ERRORS.GENERR_NO_DATA, MsgType.ERROR)

    logMsg(`Participant document ${participantDoc.id} okay`, MsgType.DEBUG)

    const circuits = await getCeremonyCircuits(`${collections.ceremonies}/${ceremonyDoc.id}/${collections.circuits}`)

    // Already contributed to all circuits.
    if (
      participantData?.contributionProgress === circuits.length + 1 ||
      participantData?.status === ParticipantStatus.DONE
    ) {
      // Update participant status.
      await participantDoc.ref.set(
        {
          status: ParticipantStatus.FINALIZING,
          lastUpdated: getCurrentServerTimestampInMillis()
        },
        { merge: true }
      )

      logMsg(`Coordinator ${participantDoc.id} ready for finalization`, MsgType.DEBUG)

      return true
    }
    return false
  }
)

/**
 * Add Verifier smart contract and verification key files metadata to the last final contribution for verifiability/integrity of the ceremony.
 */
export const finalizeLastContribution = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext): Promise<any> => {
    if (!context.auth || !context.auth.token.coordinator) logMsg(GENERIC_ERRORS.GENERR_NO_COORDINATOR, MsgType.ERROR)

    if (!data.ceremonyId || !data.circuitId || !data.bucketName)
      logMsg(GENERIC_ERRORS.GENERR_MISSING_INPUT, MsgType.ERROR)

    // Get DB.
    const firestore = admin.firestore()

    // Get Storage.
    const S3 = await getS3Client()

    // Get data.
    const { ceremonyId, circuitId, bucketName } = data
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
    const contributionDoc = await getFinalContributionDocument(
      `${collections.ceremonies}/${ceremonyId}/${collections.circuits}/${circuitId}/${collections.contributions}`
    )

    if (!ceremonyDoc.exists || !circuitDoc.exists || !participantDoc.exists || !contributionDoc.exists)
      logMsg(GENERIC_ERRORS.GENERR_INVALID_DOCUMENTS, MsgType.ERROR)

    // Get data from docs.
    const ceremonyData = ceremonyDoc.data()
    const circuitData = circuitDoc.data()
    const participantData = participantDoc.data()
    const contributionData = contributionDoc.data()

    if (!ceremonyData || !circuitData || !participantData || !contributionData)
      logMsg(GENERIC_ERRORS.GENERR_NO_DATA, MsgType.ERROR)

    logMsg(`Ceremony document ${ceremonyDoc.id} okay`, MsgType.DEBUG)
    logMsg(`Circuit document ${circuitDoc.id} okay`, MsgType.DEBUG)
    logMsg(`Participant document ${participantDoc.id} okay`, MsgType.DEBUG)
    logMsg(`Contribution document ${contributionDoc.id} okay`, MsgType.DEBUG)

    // Filenames.
    const verificationKeyFilename = `${circuitData?.prefix}_vkey.json`
    const verifierContractFilename = `${circuitData?.prefix}_verifier.sol`

    // Get storage paths.
    const verificationKeyStoragePath = `${collections.circuits}/${circuitData?.prefix}/${verificationKeyFilename}`
    const verifierContractStoragePath = `${collections.circuits}/${circuitData?.prefix}/${verifierContractFilename}`

    // Temporary store files from bucket.
    const verificationKeyTmpFilePath = path.join(os.tmpdir(), verificationKeyFilename)
    const verifierContractTmpFilePath = path.join(os.tmpdir(), verifierContractFilename)

    await tempDownloadFromBucket(S3, bucketName, verificationKeyStoragePath, verificationKeyTmpFilePath)
    await tempDownloadFromBucket(S3, bucketName, verifierContractStoragePath, verifierContractTmpFilePath)

    // Compute blake2b hash before unlink.
    const verificationKeyBuffer = fs.readFileSync(verificationKeyTmpFilePath)
    const verifierContractBuffer = fs.readFileSync(verifierContractTmpFilePath)

    logMsg(`Downloads from storage completed`, MsgType.INFO)

    const verificationKeyBlake2bHash = blake.blake2bHex(verificationKeyBuffer)
    const verifierContractBlake2bHash = blake.blake2bHex(verifierContractBuffer)

    // Unlink folders.
    fs.unlinkSync(verificationKeyTmpFilePath)
    fs.unlinkSync(verifierContractTmpFilePath)

    // Update DB.
    const batch = firestore.batch()

    batch.update(contributionDoc.ref, {
      files: {
        ...contributionData?.files,
        verificationKeyBlake2bHash,
        verificationKeyFilename,
        verificationKeyStoragePath,
        verifierContractBlake2bHash,
        verifierContractFilename,
        verifierContractStoragePath
      },
      lastUpdated: getCurrentServerTimestampInMillis()
    })

    await batch.commit()

    logMsg(
      `Circuit ${circuitId} correctly finalized - Ceremony ${ceremonyDoc.id} - Coordinator ${participantDoc.id}`,
      MsgType.INFO
    )
  }
)

/**
 * Finalize a closed ceremony.
 */
export const finalizeCeremony = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext): Promise<any> => {
    if (!context.auth || !context.auth.token.coordinator) logMsg(GENERIC_ERRORS.GENERR_NO_COORDINATOR, MsgType.ERROR)

    if (!data.ceremonyId) logMsg(GENERIC_ERRORS.GENERR_MISSING_INPUT, MsgType.ERROR)

    // Get DB.
    const firestore = admin.firestore()
    // Update DB.
    const batch = firestore.batch()

    const { ceremonyId } = data
    const userId = context.auth?.uid

    // Look for documents.
    const ceremonyDoc = await firestore.collection(collections.ceremonies).doc(ceremonyId).get()
    const participantDoc = await firestore
      .collection(`${collections.ceremonies}/${ceremonyId}/${collections.participants}`)
      .doc(userId!)
      .get()

    if (!ceremonyDoc.exists || !participantDoc.exists) logMsg(GENERIC_ERRORS.GENERR_INVALID_DOCUMENTS, MsgType.ERROR)

    // Get data from docs.
    const ceremonyData = ceremonyDoc.data()
    const participantData = participantDoc.data()

    if (!ceremonyData || !participantData) logMsg(GENERIC_ERRORS.GENERR_NO_DATA, MsgType.ERROR)

    logMsg(`Ceremony document ${ceremonyDoc.id} okay`, MsgType.DEBUG)
    logMsg(`Participant document ${participantDoc.id} okay`, MsgType.DEBUG)

    // Check if the ceremony has state equal to closed.
    if (ceremonyData?.state === CeremonyState.CLOSED && participantData?.status === ParticipantStatus.FINALIZING) {
      // Finalize the ceremony.
      batch.update(ceremonyDoc.ref, { state: CeremonyState.FINALIZED })

      // Update coordinator status.
      batch.update(participantDoc.ref, {
        status: ParticipantStatus.FINALIZED
      })

      await batch.commit()

      logMsg(`Ceremony ${ceremonyDoc.id} correctly finalized - Coordinator ${participantDoc.id}`, MsgType.INFO)
    }
  }
)
