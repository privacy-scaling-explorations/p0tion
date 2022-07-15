import * as functions from "firebase-functions"
import admin from "firebase-admin"
import path from "path"
import os from "os"
import fs from "fs"
import blake from "blakejs"
import { showErrorOrLog, GENERIC_ERRORS } from "./lib/logs.js"
import { collections } from "./lib/constants.js"
import { CeremonyState, ParticipantStatus } from "../types/index.js"
import { getCurrentServerTimestampInMillis, getFinalContributionDocument } from "./lib/utils.js"

/**
 * Finalize the final circuit contribution.
 */
export const finalizeCircuit = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext): Promise<any> => {
    if (!context.auth || !context.auth.token.coordinator) showErrorOrLog(GENERIC_ERRORS.GENERR_NO_COORDINATOR, true)

    if (!data.ceremonyId || !data.circuitId) showErrorOrLog(GENERIC_ERRORS.GENERR_MISSING_INPUT, true)

    // Get DB.
    const firestore = admin.firestore()

    // Get data.
    const { ceremonyId, circuitId } = data
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
      showErrorOrLog(GENERIC_ERRORS.GENERR_INVALID_DOCUMENTS, true)

    // Get data from docs.
    const ceremonyData = ceremonyDoc.data()
    const circuitData = circuitDoc.data()
    const participantData = participantDoc.data()
    const contributionData = contributionDoc.data()

    if (!ceremonyData || !circuitData || !participantData || !contributionData)
      showErrorOrLog(GENERIC_ERRORS.GENERR_NO_DATA, true)

    // Filenames.
    const verificationKeyFilename = `${circuitData?.prefix}_vkey.json`
    const verifierContractFilename = `${circuitData?.prefix}_verifier.sol`

    // Get storage paths.
    const verificationKeyStoragePath = `${ceremonyData?.prefix}/${collections.circuits}/${circuitData?.prefix}/${verificationKeyFilename}`
    const verifierContractStoragePath = `${ceremonyData?.prefix}/${collections.circuits}/${circuitData?.prefix}/${verifierContractFilename}`

    // Temporary store files from bucket.
    const bucket = admin.storage().bucket()

    const verificationKeyTmpFilePath = path.join(os.tmpdir(), verificationKeyFilename)
    const verifierContractTmpFilePath = path.join(os.tmpdir(), verifierContractFilename)

    await bucket.file(verificationKeyStoragePath).download({ destination: verificationKeyTmpFilePath })
    await bucket.file(verifierContractStoragePath).download({ destination: verifierContractTmpFilePath })

    // Compute blake2b hash before unlink.
    const verificationKeyBuffer = fs.readFileSync(verificationKeyTmpFilePath)
    const verifierContractBuffer = fs.readFileSync(verifierContractTmpFilePath)

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

    showErrorOrLog(`Coordinator ${userId} has finalized the final contribution for circuit ${circuitId}`, false)
  }
)

/**
 * Finalize a closed ceremony.
 */
export const finalizeCeremony = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext): Promise<any> => {
    if (!context.auth || !context.auth.token.coordinator) showErrorOrLog(GENERIC_ERRORS.GENERR_NO_COORDINATOR, true)

    if (!data.ceremonyId) showErrorOrLog(GENERIC_ERRORS.GENERR_MISSING_INPUT, true)

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

    if (!ceremonyDoc.exists || !participantDoc.exists) showErrorOrLog(GENERIC_ERRORS.GENERR_INVALID_DOCUMENTS, true)

    // Get data from docs.
    const ceremonyData = ceremonyDoc.data()
    const participantData = participantDoc.data()

    if (!ceremonyData || !participantData) showErrorOrLog(GENERIC_ERRORS.GENERR_NO_DATA, true)

    // Check if the ceremony has state equal to closed.
    if (ceremonyData?.state === CeremonyState.CLOSED && participantData?.status === ParticipantStatus.FINALIZING) {
      // Finalize the ceremony.
      batch.update(ceremonyDoc.ref, { state: CeremonyState.FINALIZED })

      // Update coordinator status.
      batch.update(participantDoc.ref, {
        status: ParticipantStatus.FINALIZED
      })

      await batch.commit()
    }
  }
)
