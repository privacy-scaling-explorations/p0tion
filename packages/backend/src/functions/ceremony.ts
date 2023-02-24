import * as functions from "firebase-functions"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { DocumentSnapshot, QueryDocumentSnapshot } from "firebase-functions/v1/firestore"
import { CeremonyState, ParticipantStatus, CeremonyType } from "@zkmpc/actions/src/types/enums"
import { CircuitWaitingQueue } from "@zkmpc/actions/src/types"
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
import { SetupCeremonyData } from "../../types"
import { COMMON_ERRORS, logAndThrowError, printLog } from "../lib/errors"
import {
    queryCeremoniesByStateAndDate,
    getCurrentServerTimestampInMillis,
    getFinalContributionDocument,
    downloadArtifactFromS3Bucket
} from "../lib/utils"
import { LogLevel } from "../../types/enums"

dotenv.config()

/**
 * Make a scheduled ceremony open.
 * @dev this function automatically runs every 30 minutes.
 * @todo this methodology for transitioning a ceremony from `scheduled` to `opened` state will be replaced with one
 * that resolves the issues presented in the issue #192 (https://github.com/quadratic-funding/mpc-phase2-suite/issues/192).
 */
export const startCeremony = functions.pubsub.schedule(`every 30 minutes`).onRun(async () => {
    // Get ready to be opened ceremonies.
    const scheduledCeremoniesQuerySnap = await queryCeremoniesByStateAndDate(
        CeremonyState.SCHEDULED,
        commonTerms.collections.ceremonies.fields.startDate,
        "<="
    )

    if (!scheduledCeremoniesQuerySnap.empty)
        scheduledCeremoniesQuerySnap.forEach(async (ceremonyDoc: DocumentSnapshot) => {
            // Make state transition to start ceremony.
            await ceremonyDoc.ref.set({ state: CeremonyState.OPENED }, { merge: true })

            printLog(`Ceremony ${ceremonyDoc.id} is now open`, LogLevel.DEBUG)
        })
})

/**
 * Make a scheduled ceremony close.
 * @dev this function automatically runs every 30 minutes.
 * @todo this methodology for transitioning a ceremony from `opened` to `closed` state will be replaced with one
 * that resolves the issues presented in the issue #192 (https://github.com/quadratic-funding/mpc-phase2-suite/issues/192).
 */
export const stopCeremony = functions.pubsub.schedule(`every 30 minutes`).onRun(async () => {
    // Get opened ceremonies.
    const runningCeremoniesQuerySnap = await queryCeremoniesByStateAndDate(
        CeremonyState.OPENED,
        commonTerms.collections.ceremonies.fields.endDate,
        "<="
    )

    if (!runningCeremoniesQuerySnap.empty) {
        runningCeremoniesQuerySnap.forEach(async (ceremonyDoc: DocumentSnapshot) => {
            // Make state transition to close ceremony.
            await ceremonyDoc.ref.set({ state: CeremonyState.CLOSED }, { merge: true })

            printLog(`Ceremony ${ceremonyDoc.id} is now closed`, LogLevel.DEBUG)
        })
    }
})

/**
 * Register all ceremony setup-related documents on the Firestore database.
 * @dev this function will create a new document in the `ceremonies` collection and as needed `circuit`
 * documents in the sub-collection.
 */
export const setupCeremony = functions.https.onCall(
    async (data: SetupCeremonyData, context: functions.https.CallableContext): Promise<any> => {
        // Check if the user has the coordinator claim.
        if (!context.auth || !context.auth.token.coordinator) logAndThrowError(COMMON_ERRORS.CM_NOT_COORDINATOR_ROLE)

        // Validate the provided data.
        if (!data.ceremonyInputData || !data.ceremonyPrefix || !data.circuits.length)
            logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Prepare Firestore DB.
        const firestore = admin.firestore()
        const batch = firestore.batch()

        // Prepare data.
        const { ceremonyInputData, ceremonyPrefix, circuits } = data
        const userId = context.auth?.uid

        // Create a new ceremony document.
        const ceremonyDoc = await firestore.collection(`${commonTerms.collections.ceremonies.name}`).doc().get()

        // Prepare tx to write ceremony data.
        batch.create(ceremonyDoc.ref, {
            title: ceremonyInputData.title,
            description: ceremonyInputData.description,
            startDate: new Date(ceremonyInputData.startDate).valueOf(),
            endDate: new Date(ceremonyInputData.endDate).valueOf(),
            prefix: ceremonyPrefix,
            state: CeremonyState.SCHEDULED,
            type: CeremonyType.PHASE2,
            penalty: ceremonyInputData.penalty,
            timeoutType: ceremonyInputData.timeoutMechanismType,
            coordinatorId: userId,
            lastUpdated: getCurrentServerTimestampInMillis()
        })

        // Create a new circuit document (circuits ceremony document sub-collection).
        for (const circuit of circuits) {
            // Get a new circuit document.
            const circuitDoc = await firestore.collection(getCircuitsCollectionPath(ceremonyDoc.ref.id)).doc().get()

            // Prepare tx to write circuit data.
            batch.create(circuitDoc.ref, {
                ...circuit,
                lastUpdated: getCurrentServerTimestampInMillis()
            })
        }

        // Send txs in a batch (to avoid race conditions).
        await batch.commit()

        printLog(`Setup completed for ceremony ${ceremonyDoc.id}`, LogLevel.DEBUG)

        return ceremonyDoc.id
    }
)

/**
 * Prepare all the necessary information needed for initializing the waiting queue of a circuit.
 * @dev this function will add a new field `waitingQueue` in the newly created circuit document.
 */
export const initEmptyWaitingQueueForCircuit = functions.firestore
    .document(
        `/${commonTerms.collections.ceremonies.name}/{ceremony}/${commonTerms.collections.circuits.name}/{circuit}`
    )
    .onCreate(async (doc: QueryDocumentSnapshot) => {
        // Prepare Firestore DB.
        const firestore = admin.firestore()

        // Get circuit document identifier and data.
        const circuitId = doc.id
        // Get parent ceremony collection path.
        const parentCollectionPath = doc.ref.parent.path // == /ceremonies/{ceremony}/circuits/.

        // Define an empty waiting queue.
        const emptyWaitingQueue: CircuitWaitingQueue = {
            contributors: [],
            currentContributor: "",
            completedContributions: 0,
            failedContributions: 0
        }

        // Update the circuit document.
        await firestore.collection(parentCollectionPath).doc(circuitId).set(
            {
                waitingQueue: emptyWaitingQueue,
                lastUpdated: getCurrentServerTimestampInMillis()
            },
            { merge: true }
        )

        printLog(
            `An empty waiting queue has been successfully initialized for circuit ${circuitId} which belongs to ceremony ${doc.id}`,
            LogLevel.DEBUG
        )
    })

/// @todo needs refactoring below.

/**
 * Add Verifier smart contract and verification key files metadata to the last final contribution for verifiability/integrity of the ceremony.
 */
export const finalizeLastContribution = functions.https.onCall(
    async (data: any, context: functions.https.CallableContext): Promise<any> => {
        if (!context.auth || !context.auth.token.coordinator)
            printLog(COMMON_ERRORS.GENERR_NO_COORDINATOR, LogLevel.ERROR)

        if (!data.ceremonyId || !data.circuitId || !data.bucketName)
            logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Get DB.
        const firestore = admin.firestore()

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

        await downloadArtifactFromS3Bucket(bucketName, verificationKeyStoragePath, verificationKeyTmpFilePath)
        await downloadArtifactFromS3Bucket(bucketName, verifierContractStoragePath, verifierContractTmpFilePath)

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

        if (!data.ceremonyId) logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

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
