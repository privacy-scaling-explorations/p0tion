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
import winston from "winston"
import { FieldValue } from "firebase-admin/firestore"
import {
    blake512FromPath,
    commonTerms,
    getParticipantsCollectionPath,
    getCircuitsCollectionPath,
    getPotStorageFilePath,
    getZkeyStorageFilePath,
    getContributionsCollectionPath,
    genesisZkeyIndex,
    formatZkeyIndex
} from "@zkmpc/actions/src"
import { getTranscriptStorageFilePath } from "@zkmpc/actions/src/helpers/storage"
import { ParticipantStatus, ParticipantContributionStep, CeremonyState } from "@zkmpc/actions/src/types/enums"
import {
    deleteObject,
    getCircuitDocumentByPosition,
    getCurrentServerTimestampInMillis,
    sleep,
    tempDownloadFromBucket,
    uploadFileToBucket
} from "../lib/utils"
import { COMMON_ERRORS, logAndThrowError, printLog } from "../lib/errors"
import { LogLevel } from "../../types/enums"
import { getS3Client } from "../lib/services"

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

    printLog(`Circuit document ${circuit.id} okay`, LogLevel.DEBUG)
    printLog(`Participant document ${participantId} okay`, LogLevel.DEBUG)

    const { waitingQueue } = circuitData
    const { contributors } = waitingQueue
    let { currentContributor } = waitingQueue
    let newParticipantStatus: string = ""
    let newContributionStep: string = ""

    // Case 1: Participant is ready to contribute and there's nobody in the queue.
    if (!contributors.length && !currentContributor) {
        printLog(
            `Coordination use-case 1: Participant is ready to contribute and there's nobody in the queue`,
            LogLevel.INFO
        )

        currentContributor = participantId
        newParticipantStatus = ParticipantStatus.CONTRIBUTING
        newContributionStep = ParticipantContributionStep.DOWNLOADING
    }

    // Case 2: Participant is ready to contribute but there's another participant currently contributing.
    if (currentContributor !== participantId) {
        printLog(
            `Coordination use-case 2: Participant is ready to contribute but there's another participant currently contributing`,
            LogLevel.INFO
        )

        newParticipantStatus = ParticipantStatus.WAITING
    }

    // Case 3: the participant has finished the contribution so this case is used to update the i circuit queue.
    if (
        currentContributor === participantId &&
        (participantData.status === ParticipantStatus.CONTRIBUTED ||
            participantData.status === ParticipantStatus.DONE) &&
        participantData.contributionStep === ParticipantContributionStep.COMPLETED
    ) {
        printLog(
            `Coordination use-case 3: Participant has finished the contribution so this case is used to update the i circuit queue`,
            LogLevel.INFO
        )

        contributors.shift(1)

        if (contributors.length > 0) {
            // There's someone else ready to contribute.
            currentContributor = contributors.at(0)

            // Pass the baton to the next participant.
            const newCurrentContributorDoc = await firestore
                .collection(getParticipantsCollectionPath(ceremonyId!))
                .doc(currentContributor)
                .get()

            if (newCurrentContributorDoc.exists) {
                batch.update(newCurrentContributorDoc.ref, {
                    status: ParticipantStatus.WAITING,
                    lastUpdated: getCurrentServerTimestampInMillis()
                })

                printLog(`Batch update use-case 3: New current contributor`, LogLevel.INFO)
            }
        } else currentContributor = ""
    }

    // Updates for cases 1 and 2.
    if (newParticipantStatus) {
        contributors.push(participantId)

        batch.update(participant.ref, {
            status: newParticipantStatus,
            contributionStartedAt:
                newParticipantStatus === ParticipantStatus.CONTRIBUTING ? getCurrentServerTimestampInMillis() : 0,
            lastUpdated: getCurrentServerTimestampInMillis()
        })

        // Case 1 only.
        if (newContributionStep)
            batch.update(participant.ref, {
                contributionStep: newContributionStep,
                lastUpdated: getCurrentServerTimestampInMillis()
            })

        printLog(`Batch update use-case 1 or 2: participant updates`, LogLevel.INFO)
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

    printLog(`Batch update all use-cases: update circuit waiting queue`, LogLevel.INFO)

    await batch.commit()
}

/**
 * Coordinate waiting queue contributors.
 */
export const coordinateContributors = functionsV1.firestore
    .document(
        `${commonTerms.collections.ceremonies.name}/{ceremonyId}/${commonTerms.collections.participants.name}/{participantId}`
    )
    .onUpdate(async (change: Change<QueryDocumentSnapshot>) => {
        // Before changes.
        const participantBefore = change.before
        const dataBefore = participantBefore.data()
        const {
            contributionProgress: beforeContributionProgress,
            status: beforeStatus,
            contributionStep: beforeContributionStep
        } = dataBefore

        // After changes.
        const participantAfter = change.after
        const dataAfter = participantAfter.data()
        const {
            contributionProgress: afterContributionProgress,
            status: afterStatus,
            contributionStep: afterContributionStep
        } = dataAfter

        // Get the ceremony identifier (this does not change from before/after).
        const ceremonyId = participantBefore.ref.parent.parent!.path

        if (!ceremonyId) logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        printLog(`Coordinating participants for ceremony ${ceremonyId}`, LogLevel.INFO)

        printLog(`Participant document ${participantBefore.id} okay`, LogLevel.DEBUG)
        printLog(`Participant document ${participantAfter.id} okay`, LogLevel.DEBUG)
        printLog(
            `Participant ${participantBefore.id} the status from ${beforeStatus} to ${afterStatus} and the contribution progress from ${beforeContributionProgress} to ${afterContributionProgress}`,
            LogLevel.INFO
        )

        // nb. existance checked above.
        const circuitsPath = `${participantBefore.ref.parent.parent!.path}/${commonTerms.collections.circuits.name}`

        // When a participant changes is status to ready, is "ready" to become a contributor.
        if (afterStatus === ParticipantStatus.READY) {
            // When beforeContributionProgress === 0 is a new participant, when beforeContributionProgress === afterContributionProgress the participant is retrying.
            if (beforeContributionProgress === 0 || beforeContributionProgress === afterContributionProgress) {
                printLog(
                    `Participant has status READY and before contribution progress ${beforeContributionProgress} is different from after contribution progress ${afterContributionProgress}`,
                    LogLevel.INFO
                )

                // i -> k where i == 0
                // (participant newly created). We work only on circuit k.
                const circuit = await getCircuitDocumentByPosition(circuitsPath, afterContributionProgress)

                printLog(`Circuit document ${circuit.id} okay`, LogLevel.DEBUG)

                // The circuit info (i.e., the queue) is useful only to check turns for contribution.
                // The participant info is useful to really pass the baton (starting the contribution).
                // So, the info on the circuit says "it's your turn" while the info on the participant says "okay, i'm ready/waiting etc.".
                // The contribution progress number completes everything because indicates which circuit is involved.
                await coordinate(circuit, participantAfter)
                printLog(`Circuit ${circuit.id} has been updated (waiting queue)`, LogLevel.INFO)
            }

            if (afterContributionProgress === beforeContributionProgress + 1 && beforeContributionProgress !== 0) {
                printLog(
                    `Participant has status READY and before contribution progress ${beforeContributionProgress} is different from before contribution progress ${afterContributionProgress}`,
                    LogLevel.INFO
                )

                // i -> k where k === i + 1
                // (participant has already contributed to i and the contribution has been verified,
                // participant now is ready to be put in line for contributing on k circuit).

                const afterCircuit = await getCircuitDocumentByPosition(circuitsPath, afterContributionProgress)

                // printLog(`Circuit document ${beforeCircuit.id} okay`, LogLevel.DEBUG)
                printLog(`Circuit document ${afterCircuit.id} okay`, LogLevel.DEBUG)

                // Coordinate after circuit (update waiting queue).
                await coordinate(afterCircuit, participantAfter)
                printLog(`After circuit ${afterCircuit.id} has been updated (waiting queue)`, LogLevel.INFO)
            }
        }

        // The contributor has finished the contribution and the waiting queue for the circuit needs to be updated.
        if (
            (afterStatus === ParticipantStatus.DONE && beforeStatus !== ParticipantStatus.DONE) ||
            (beforeContributionProgress === afterContributionProgress &&
                afterStatus === ParticipantStatus.CONTRIBUTED &&
                beforeStatus === ParticipantStatus.CONTRIBUTING &&
                beforeContributionStep === ParticipantContributionStep.VERIFYING &&
                afterContributionStep === ParticipantContributionStep.COMPLETED)
        ) {
            printLog(`Participant has status DONE or has finished the contribution`, LogLevel.INFO)

            // Update the last circuits waiting queue.
            const beforeCircuit = await getCircuitDocumentByPosition(circuitsPath, beforeContributionProgress)

            printLog(`Circuit document ${beforeCircuit.id} okay`, LogLevel.DEBUG)

            // Coordinate before circuit (update waiting queue + pass the baton to the next).
            await coordinate(beforeCircuit, participantAfter, ceremonyId)
            printLog(
                `Before circuit ${beforeCircuit.id} has been updated (waiting queue + pass the baton to next)`,
                LogLevel.INFO
            )
        }
    })

/**
 * Automate the contribution verification.
 */
export const verifycontribution = functionsV2.https.onCall(
    { memory: "16GiB", timeoutSeconds: 3600 },
    async (request: functionsV2.https.CallableRequest<any>): Promise<any> => {
        const verifyCloudFunctionTimer = new Timer({ label: "verifyCloudFunction" })
        verifyCloudFunctionTimer.start()

        if (!request.auth || (!request.auth.token.participant && !request.auth.token.coordinator))
            printLog(COMMON_ERRORS.GENERR_NO_AUTH_USER_FOUND, LogLevel.ERROR)

        if (!request.data.ceremonyId || !request.data.circuitId || !request.data.ghUsername || !request.data.bucketName)
            logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Get DB.
        const firestore = admin.firestore()

        // Get Storage.
        const S3 = await getS3Client()

        // Get data.
        const { ceremonyId, circuitId, ghUsername, bucketName } = request.data
        const userId = request.auth?.uid

        // Look for documents.
        const ceremonyDoc = await firestore.collection(commonTerms.collections.ceremonies.name).doc(ceremonyId).get()
        const circuitDoc = await firestore.collection(getCircuitsCollectionPath(ceremonyId)).doc(circuitId).get()
        const participantDoc = await firestore.collection(getParticipantsCollectionPath(ceremonyId)).doc(userId!).get()

        if (!ceremonyDoc.exists || !circuitDoc.exists || !participantDoc.exists)
            printLog(COMMON_ERRORS.GENERR_INVALID_DOCUMENTS, LogLevel.ERROR)

        // Get data from docs.
        const ceremonyData = ceremonyDoc.data()
        const circuitData = circuitDoc.data()
        const participantData = participantDoc.data()

        if (!ceremonyData || !circuitData || !participantData) printLog(COMMON_ERRORS.GENERR_NO_DATA, LogLevel.ERROR)

        printLog(`Ceremony document ${ceremonyDoc.id} okay`, LogLevel.DEBUG)
        printLog(`Circuit document ${circuitDoc.id} okay`, LogLevel.DEBUG)
        printLog(`Participant document ${participantDoc.id} okay`, LogLevel.DEBUG)

        let valid = false
        let verificationComputationTime = 0
        let fullContributionTime = 0

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
            const transcriptStoragePath = getTranscriptStorageFilePath(circuitData?.prefix, transcriptFilename)
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
            const potStoragePath = getPotStorageFilePath(circuitData?.files.potFilename)
            const firstZkeyStoragePath = getZkeyStorageFilePath(
                circuitData?.prefix,
                `${circuitData?.prefix}_${genesisZkeyIndex}.zkey`
            )
            const lastZkeyStoragePath = getZkeyStorageFilePath(
                circuitData?.prefix,
                `${circuitData?.prefix}_${finalize ? `final` : lastZkeyIndex}.zkey`
            )

            // Temporary store files from bucket.
            const { potFilename } = circuitData!.files
            const firstZkeyFilename = `${circuitData?.prefix}_00000.zkey`
            const lastZkeyFilename = `${circuitData?.prefix}_${finalize ? `final` : lastZkeyIndex}.zkey`

            const potTempFilePath = path.join(os.tmpdir(), potFilename)
            const firstZkeyTempFilePath = path.join(os.tmpdir(), firstZkeyFilename)
            const lastZkeyTempFilePath = path.join(os.tmpdir(), lastZkeyFilename)

            // Download from AWS S3 bucket.
            await tempDownloadFromBucket(S3, bucketName, potStoragePath, potTempFilePath)
            printLog(`${potStoragePath} downloaded`, LogLevel.DEBUG)

            await tempDownloadFromBucket(S3, bucketName, firstZkeyStoragePath, firstZkeyTempFilePath)
            printLog(`${firstZkeyStoragePath} downloaded`, LogLevel.DEBUG)

            await tempDownloadFromBucket(S3, bucketName, lastZkeyStoragePath, lastZkeyTempFilePath)
            printLog(`${lastZkeyStoragePath} downloaded`, LogLevel.DEBUG)

            printLog(`Downloads from storage completed`, LogLevel.INFO)

            // Verify contribution.
            const verificationComputationTimer = new Timer({ label: "verificationComputation" })
            verificationComputationTimer.start()

            valid = await zKey.verifyFromInit(
                firstZkeyTempFilePath,
                potTempFilePath,
                lastZkeyTempFilePath,
                transcriptLogger
            )

            verificationComputationTimer.stop()

            verificationComputationTime = verificationComputationTimer.ms()

            printLog(`Contribution is ${valid ? `valid` : `invalid`}`, LogLevel.INFO)
            printLog(`Verification computation time ${verificationComputationTime} ms`, LogLevel.INFO)

            // Compute blake2b hash before unlink.
            const lastZkeyBlake2bHash = await blake512FromPath(lastZkeyTempFilePath)

            // Unlink folders.
            fs.unlinkSync(potTempFilePath)
            fs.unlinkSync(firstZkeyTempFilePath)
            fs.unlinkSync(lastZkeyTempFilePath)

            // Update DB.
            const batch = firestore.batch()

            // Contribution.
            const contributionDoc = await firestore
                .collection(getContributionsCollectionPath(ceremonyId, circuitId))
                .doc()
                .get()

            if (valid) {
                // Sleep ~5 seconds to wait for verification transcription.
                await sleep(5000)

                // Upload transcript (small file - multipart upload not required).
                await uploadFileToBucket(S3, bucketName, transcriptStoragePath, transcriptTempFilePath)

                // Compute blake2b hash.
                const transcriptBlake2bHash = await blake512FromPath(transcriptTempFilePath)

                fs.unlinkSync(transcriptTempFilePath)

                // Get contribution computation time.
                const contributions = participantData?.contributions.filter(
                    (contribution: { hash: string; doc: string; computationTime: number }) =>
                        !!contribution.hash && !!contribution.computationTime && !contribution.doc
                )

                if (contributions.length !== 1)
                    printLog(`There should be only one contribution without a doc link`, LogLevel.ERROR)

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

                printLog(`Batch: create contribution document`, LogLevel.DEBUG)

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

                    printLog(
                        `Current average full contribution (down + comp + up) time ${avgFullContribution} ms`,
                        LogLevel.INFO
                    )
                    printLog(`Current verify cloud function time ${avgVerifyCloudFunction} ms`, LogLevel.INFO)

                    // Calculate full contribution time.
                    fullContributionTime =
                        Number(participantData?.verificationStartedAt) - Number(participantData?.contributionStartedAt)

                    // Update avg timings.
                    const newAvgContributionComputationTime =
                        avgContributionComputation > 0
                            ? (avgContributionComputation + contributionComputationTime) / 2
                            : contributionComputationTime
                    const newAvgFullContributionTime =
                        avgFullContribution > 0
                            ? (avgFullContribution + fullContributionTime) / 2
                            : fullContributionTime
                    const newAvgVerifyCloudFunctionTime =
                        avgVerifyCloudFunction > 0
                            ? (avgVerifyCloudFunction + verifyCloudFunctionTime) / 2
                            : verifyCloudFunctionTime

                    printLog(
                        `New average contribution computation time ${newAvgContributionComputationTime} ms`,
                        LogLevel.INFO
                    )
                    printLog(
                        `New average full contribution (down + comp + up) time ${newAvgFullContributionTime} ms`,
                        LogLevel.INFO
                    )
                    printLog(`New verify cloud function time ${newAvgVerifyCloudFunctionTime} ms`, LogLevel.INFO)

                    batch.update(circuitDoc.ref, {
                        avgTimings: {
                            contributionComputation: valid
                                ? newAvgContributionComputationTime
                                : contributionComputationTime,
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

                printLog(`Batch: update timings and waiting queue for circuit`, LogLevel.DEBUG)

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

                printLog(`Batch: create invalid contribution document`, LogLevel.DEBUG)

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
                printLog(`Batch: update invalid contributions counter`, LogLevel.DEBUG)

                await batch.commit()
            }
        }

        printLog(
            `Participant ${userId} has verified the contribution #${participantData?.contributionProgress}`,
            LogLevel.INFO
        )
        printLog(
            `Returned values: valid ${valid} - verificationComputationTime ${verificationComputationTime}`,
            LogLevel.INFO
        )

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
        `/${commonTerms.collections.ceremonies.name}/{ceremony}/${commonTerms.collections.circuits.name}/{circuit}/${commonTerms.collections.contributions.name}/{contributions}`
    )
    .onCreate(async (doc: QueryDocumentSnapshot) => {
        // Get DB.
        const firestore = admin.firestore()

        // Get doc info.
        const contributionId = doc.id
        const contributionData = doc.data()
        const ceremonyCircuitsCollectionPath = doc.ref.parent.parent?.parent?.path // == /ceremonies/{ceremony}/circuits/.
        const ceremonyParticipantsCollectionPath = `${doc.ref.parent.parent?.parent?.parent?.path}/${commonTerms.collections.participants.name}` // == /ceremonies/{ceremony}/participants.

        if (!ceremonyCircuitsCollectionPath || !ceremonyParticipantsCollectionPath)
            printLog(COMMON_ERRORS.GENERR_WRONG_PATHS, LogLevel.ERROR)

        // Looks for documents.
        const circuits = await firestore.collection(ceremonyCircuitsCollectionPath!).listDocuments()
        const participantDoc = await firestore
            .collection(ceremonyParticipantsCollectionPath)
            .doc(contributionData.participantId)
            .get()

        if (!participantDoc.exists) printLog(COMMON_ERRORS.GENERR_INVALID_DOCUMENTS, LogLevel.ERROR)

        // Get data.
        const participantData = participantDoc.data()

        if (!participantData) printLog(COMMON_ERRORS.GENERR_NO_DATA, LogLevel.ERROR)

        printLog(`Participant document ${participantDoc.id} okay`, LogLevel.DEBUG)

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
                    ? ParticipantStatus.DONE
                    : ParticipantStatus.CONTRIBUTED

            await firestore.collection(ceremonyParticipantsCollectionPath).doc(contributionData.participantId).set(
                {
                    status: newStatus,
                    contributionStep: ParticipantContributionStep.COMPLETED,
                    contributions: participantContributions,
                    tempContributionData: FieldValue.delete(),
                    lastUpdated: getCurrentServerTimestampInMillis()
                },
                { merge: true }
            )

            printLog(`Participant ${contributionData.participantId} updated after contribution`, LogLevel.DEBUG)
        } else {
            await firestore.collection(ceremonyParticipantsCollectionPath).doc(contributionData.participantId).set(
                {
                    contributions: participantContributions,
                    lastUpdated: getCurrentServerTimestampInMillis()
                },
                { merge: true }
            )

            printLog(`Coordinator ${contributionData.participantId} updated after final contribution`, LogLevel.DEBUG)
        }
    })

/**
 * Make the progress to next contribution after successfully verified the contribution.
 */
export const makeProgressToNextContribution = functionsV1.https.onCall(
    async (data: any, context: functionsV1.https.CallableContext): Promise<any> => {
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            printLog(COMMON_ERRORS.GENERR_NO_AUTH_USER_FOUND, LogLevel.ERROR)

        if (!data.ceremonyId) logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Get DB.
        const firestore = admin.firestore()

        // Get data.
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

        const { contributionProgress, contributionStep, status } = participantData!

        // Check for contribution completion here.
        if (contributionStep !== ParticipantContributionStep.COMPLETED && status !== ParticipantStatus.WAITING)
            printLog(`Cannot progress!`, LogLevel.ERROR)

        await participantDoc.ref.update({
            contributionProgress: contributionProgress + 1,
            status: ParticipantStatus.READY,
            lastUpdated: getCurrentServerTimestampInMillis()
        })

        printLog(`Participant ${userId} progressed to ${contributionProgress + 1}`, LogLevel.DEBUG)
    }
)

/**
 * Resume a contribution after a timeout expiration.
 */
export const resumeContributionAfterTimeoutExpiration = functionsV1.https.onCall(
    async (data: any, context: functionsV1.https.CallableContext): Promise<any> => {
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            printLog(COMMON_ERRORS.GENERR_NO_AUTH_USER_FOUND, LogLevel.ERROR)

        if (!data.ceremonyId) logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Get DB.
        const firestore = admin.firestore()

        // Get data.
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

        const { contributionProgress, status } = participantData!

        // Check if can resume.
        if (status !== ParticipantStatus.EXHUMED)
            printLog(`Cannot resume the contribution after a timeout expiration`, LogLevel.ERROR)

        await participantDoc.ref.update({
            status: ParticipantStatus.READY,
            lastUpdated: getCurrentServerTimestampInMillis()
        })

        printLog(
            `Participant ${userId} has resumed the contribution for circuit ${contributionProgress}`,
            LogLevel.DEBUG
        )
    }
)
