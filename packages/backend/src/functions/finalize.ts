import * as functions from "firebase-functions"
import admin from "firebase-admin"
import path from "path"
import os from "os"
import fs from "fs"
import blake from "blakejs"
import {
    commonTerms,
    getCircuitsCollectionPath,
    getContributionsCollectionPath,
    getParticipantsCollectionPath,
    getVerificationKeyStorageFilePath,
    getVerifierContractStorageFilePath
} from "@zkmpc/actions/src"
import { CeremonyState, ParticipantStatus } from "@zkmpc/actions/src/types/enums"
import { COMMON_ERRORS, printLog } from "../lib/errors"
import { LogLevel } from "../../types/enums"
import {
    getCeremonyCircuits,
    getCurrentServerTimestampInMillis,
    getFinalContributionDocument,
    getS3Client,
    tempDownloadFromBucket
} from "../lib/utils"

/**
 * Check and prepare the coordinator for the ceremony finalization.
 */
export const checkAndPrepareCoordinatorForFinalization = functions.https.onCall(
    async (data: any, context: functions.https.CallableContext) => {
        // Check if sender is authenticated.
        if (!context.auth || !context.auth.token.coordinator)
            printLog(COMMON_ERRORS.GENERR_NO_AUTH_USER_FOUND, LogLevel.ERROR)

        if (!data.ceremonyId) printLog(COMMON_ERRORS.GENERR_NO_CEREMONY_PROVIDED, LogLevel.ERROR)

        // Get DB.
        const firestore = admin.firestore()

        // Get data.
        const { ceremonyId } = data
        const userId = context.auth?.uid

        // Look for the ceremony.
        const ceremonyDoc = await firestore.collection(commonTerms.collections.ceremonies.name).doc(ceremonyId).get()

        // Check existence.
        if (!ceremonyDoc.exists) printLog(COMMON_ERRORS.GENERR_INVALID_CEREMONY, LogLevel.ERROR)

        // Get ceremony data.
        const ceremonyData = ceremonyDoc.data()

        // Check if running.
        if (!ceremonyData || ceremonyData.state !== CeremonyState.CLOSED)
            printLog(COMMON_ERRORS.GENERR_CEREMONY_NOT_CLOSED, LogLevel.ERROR)

        // Look for the coordinator among ceremony participant.
        const participantDoc = await firestore.collection(getParticipantsCollectionPath(ceremonyId)).doc(userId!).get()

        // Check if the coordinator has completed the contributions for all circuits.
        const participantData = participantDoc.data()

        if (!participantData) printLog(COMMON_ERRORS.GENERR_NO_DATA, LogLevel.ERROR)

        printLog(`Participant document ${participantDoc.id} okay`, LogLevel.DEBUG)

        const circuits = await getCeremonyCircuits(getCircuitsCollectionPath(ceremonyDoc.id))

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

            printLog(`Coordinator ${participantDoc.id} ready for finalization`, LogLevel.DEBUG)

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
        if (!context.auth || !context.auth.token.coordinator)
            printLog(COMMON_ERRORS.GENERR_NO_COORDINATOR, LogLevel.ERROR)

        if (!data.ceremonyId || !data.circuitId || !data.bucketName) {
            const error = COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA

            printLog(
                `${error.code}: ${error.message} ${!error.details ? "" : `\ndetails: ${error.details}`}`,
                LogLevel.ERROR
            )
            throw error
        }

        // Get DB.
        const firestore = admin.firestore()

        // Get Storage.
        const S3 = await getS3Client()

        // Get data.
        const { ceremonyId, circuitId, bucketName } = data
        const userId = context.auth?.uid

        // Look for documents.
        const ceremonyDoc = await firestore.collection(commonTerms.collections.ceremonies.name).doc(ceremonyId).get()
        const circuitDoc = await firestore.collection(getCircuitsCollectionPath(ceremonyId)).doc(circuitId).get()
        const participantDoc = await firestore.collection(getParticipantsCollectionPath(ceremonyId)).doc(userId!).get()
        const contributionDoc = await getFinalContributionDocument(
            getContributionsCollectionPath(ceremonyId, circuitId)
        )

        if (!ceremonyDoc.exists || !circuitDoc.exists || !participantDoc.exists || !contributionDoc.exists)
            printLog(COMMON_ERRORS.GENERR_INVALID_DOCUMENTS, LogLevel.ERROR)

        // Get data from docs.
        const ceremonyData = ceremonyDoc.data()
        const circuitData = circuitDoc.data()
        const participantData = participantDoc.data()
        const contributionData = contributionDoc.data()

        if (!ceremonyData || !circuitData || !participantData || !contributionData)
            printLog(COMMON_ERRORS.GENERR_NO_DATA, LogLevel.ERROR)

        printLog(`Ceremony document ${ceremonyDoc.id} okay`, LogLevel.DEBUG)
        printLog(`Circuit document ${circuitDoc.id} okay`, LogLevel.DEBUG)
        printLog(`Participant document ${participantDoc.id} okay`, LogLevel.DEBUG)
        printLog(`Contribution document ${contributionDoc.id} okay`, LogLevel.DEBUG)

        // Filenames.
        const verificationKeyFilename = `${circuitData?.prefix}_vkey.json`
        const verifierContractFilename = `${circuitData?.prefix}_verifier.sol`

        // Get storage paths.
        const verificationKeyStoragePath = getVerificationKeyStorageFilePath(
            circuitData?.prefix,
            verificationKeyFilename
        )
        const verifierContractStoragePath = getVerifierContractStorageFilePath(
            circuitData?.prefix,
            verifierContractFilename
        )

        // Temporary store files from bucket.
        const verificationKeyTmpFilePath = path.join(os.tmpdir(), verificationKeyFilename)
        const verifierContractTmpFilePath = path.join(os.tmpdir(), verifierContractFilename)

        await tempDownloadFromBucket(S3, bucketName, verificationKeyStoragePath, verificationKeyTmpFilePath)
        await tempDownloadFromBucket(S3, bucketName, verifierContractStoragePath, verifierContractTmpFilePath)

        // Compute blake2b hash before unlink.
        const verificationKeyBuffer = fs.readFileSync(verificationKeyTmpFilePath)
        const verifierContractBuffer = fs.readFileSync(verifierContractTmpFilePath)

        printLog(`Downloads from storage completed`, LogLevel.INFO)

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

        printLog(
            `Circuit ${circuitId} correctly finalized - Ceremony ${ceremonyDoc.id} - Coordinator ${participantDoc.id}`,
            LogLevel.INFO
        )
    }
)

/**
 * Finalize a closed ceremony.
 */
export const finalizeCeremony = functions.https.onCall(
    async (data: any, context: functions.https.CallableContext): Promise<any> => {
        if (!context.auth || !context.auth.token.coordinator)
            printLog(COMMON_ERRORS.GENERR_NO_COORDINATOR, LogLevel.ERROR)

        if (!data.ceremonyId) {
            const error = COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA

            printLog(
                `${error.code}: ${error.message} ${!error.details ? "" : `\ndetails: ${error.details}`}`,
                LogLevel.ERROR
            )
            throw error
        }

        // Get DB.
        const firestore = admin.firestore()
        // Update DB.
        const batch = firestore.batch()

        const { ceremonyId } = data
        const userId = context.auth?.uid

        // Look for documents.
        const ceremonyDoc = await firestore.collection(commonTerms.collections.ceremonies.name).doc(ceremonyId).get()
        const participantDoc = await firestore.collection(getParticipantsCollectionPath(ceremonyId)).doc(userId!).get()

        if (!ceremonyDoc.exists || !participantDoc.exists)
            printLog(COMMON_ERRORS.GENERR_INVALID_DOCUMENTS, LogLevel.ERROR)

        // Get data from docs.
        const ceremonyData = ceremonyDoc.data()
        const participantData = participantDoc.data()

        if (!ceremonyData || !participantData) printLog(COMMON_ERRORS.GENERR_NO_DATA, LogLevel.ERROR)

        printLog(`Ceremony document ${ceremonyDoc.id} okay`, LogLevel.DEBUG)
        printLog(`Participant document ${participantDoc.id} okay`, LogLevel.DEBUG)

        // Check if the ceremony has state equal to closed.
        if (ceremonyData?.state === CeremonyState.CLOSED && participantData?.status === ParticipantStatus.FINALIZING) {
            // Finalize the ceremony.
            batch.update(ceremonyDoc.ref, { state: CeremonyState.FINALIZED })

            // Update coordinator status.
            batch.update(participantDoc.ref, {
                status: ParticipantStatus.FINALIZED
            })

            await batch.commit()

            printLog(`Ceremony ${ceremonyDoc.id} correctly finalized - Coordinator ${participantDoc.id}`, LogLevel.INFO)
        }
    }
)
