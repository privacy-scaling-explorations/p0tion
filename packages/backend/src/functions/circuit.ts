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
    getDocumentById,
    sleep,
    tempDownloadFromBucket,
    uploadFileToBucket
} from "../lib/utils"
import { COMMON_ERRORS, logAndThrowError, printLog } from "../lib/errors"
import { LogLevel } from "../../types/enums"
import { getS3Client } from "../lib/services"

dotenv.config()

/**
 * Execute the coordination of the participant for the given circuit.
 * @dev possible coordination scenarios:
 * A) The participant becomes the current contributor of circuit X (single participant).
 * B) The participant is placed in the contribution waiting queue because someone else is currently contributing to circuit X (single participant)
 * C) The participant is removed as current contributor from Circuit X and gets coordinated for Circuit X + 1 (multi-participant).
 *    C.1) The first participant in the waiting queue for Circuit X (if any), becomes the new contributor for circuit X.
 * @param participant <QueryDocumentSnapshot> - the Firestore document of the participant.
 * @param circuit <QueryDocumentSnapshot> - the Firestore document of the circuit.
 * @param isSingleParticipantCoordination <boolean> - true if the coordination involves only a single participant; otherwise false (= involves multiple participant).
 * @param [ceremonyId] <string> - the unique identifier of the ceremony (needed only for multi-participant coordination).
 */
const coordinate = async (
    participant: QueryDocumentSnapshot,
    circuit: QueryDocumentSnapshot,
    isSingleParticipantCoordination: boolean,
    ceremonyId?: string
) => {
    // Prepare db and transactions batch.
    const firestore = admin.firestore()
    const batch = firestore.batch()

    // Extract data.
    const { status, contributionStep } = participant.data()
    const { waitingQueue } = circuit.data()
    const { contributors, currentContributor } = waitingQueue

    // Prepare state updates for waiting queue.
    const newContributors: Array<string> = contributors
    let newCurrentContributorId: string = ""

    // Prepare state updates for participant.
    let newParticipantStatus: string = ""
    let newContributionStep: string = ""

    // Prepare pre-conditions.
    const noCurrentContributor = !currentContributor
    const noContributorsInWaitingQueue = !contributors.length
    const emptyWaitingQueue = noCurrentContributor && noContributorsInWaitingQueue

    const participantIsNotCurrentContributor = currentContributor !== participant.id
    const participantIsCurrentContributor = currentContributor === participant.id
    const participantIsReady = status === ParticipantStatus.READY
    const participantResumingAfterTimeoutExpiration = participantIsCurrentContributor && participantIsReady

    const participantCompletedOneOrAllContributions =
        (status === ParticipantStatus.CONTRIBUTED || status === ParticipantStatus.DONE) &&
        contributionStep === ParticipantContributionStep.COMPLETED

    // Check for scenarios.
    if (isSingleParticipantCoordination) {
        // Scenario (A).
        if (emptyWaitingQueue) {
            printLog(`Coordinate - executing scenario A - emptyWaitingQueue`, LogLevel.DEBUG)

            // Update.
            newCurrentContributorId = participant.id
            newParticipantStatus = ParticipantStatus.CONTRIBUTING
            newContributionStep = ParticipantContributionStep.DOWNLOADING
            newContributors.push(newCurrentContributorId)
        }
        // Scenario (A).
        else if (participantResumingAfterTimeoutExpiration) {
            printLog(
                `Coordinate - executing scenario A - single - participantResumingAfterTimeoutExpiration`,
                LogLevel.DEBUG
            )

            newParticipantStatus = ParticipantStatus.CONTRIBUTING
            newContributionStep = ParticipantContributionStep.DOWNLOADING
        }
        // Scenario (B).
        else if (participantIsNotCurrentContributor) {
            printLog(`Coordinate - executing scenario B - single - participantIsNotCurrentContributor`, LogLevel.DEBUG)

            newParticipantStatus = ParticipantStatus.WAITING
            newContributors.push(participant.id)
        }

        // Prepare tx - Scenario (A) only.
        if (newContributionStep)
            batch.update(participant.ref, {
                contributionStep: newContributionStep,
                lastUpdated: getCurrentServerTimestampInMillis()
            })

        // Prepare tx - Scenario (A) or (B).
        batch.update(participant.ref, {
            status: newParticipantStatus,
            contributionStartedAt:
                newParticipantStatus === ParticipantStatus.CONTRIBUTING ? getCurrentServerTimestampInMillis() : 0,
            lastUpdated: getCurrentServerTimestampInMillis()
        })
    } else if (participantIsCurrentContributor && participantCompletedOneOrAllContributions && !!ceremonyId) {
        printLog(
            `Coordinate - executing scenario C - multi - participantIsCurrentContributor && participantCompletedOneOrAllContributions`,
            LogLevel.DEBUG
        )

        // Remove from waiting queue of circuit X.
        newContributors.shift()

        // Step (C.1).
        if (newContributors.length > 0) {
            // Get new contributor for circuit X.
            newCurrentContributorId = newContributors.at(0)!

            // Pass the baton to the new contributor.
            const newCurrentContributorDocument = await getDocumentById(
                getParticipantsCollectionPath(ceremonyId),
                newCurrentContributorId
            )

            // Prepare update tx.
            batch.update(newCurrentContributorDocument.ref, {
                status: ParticipantStatus.WAITING, // need to be refreshed.
                lastUpdated: getCurrentServerTimestampInMillis()
            })

            printLog(
                `Participant ${newCurrentContributorId} is the new current contributor for circuit ${circuit.id}`,
                LogLevel.DEBUG
            )
        }
    }

    // Prepare tx - must be done for all Scenarios.
    batch.update(circuit.ref, {
        waitingQueue: {
            ...waitingQueue,
            contributors: newContributors,
            currentContributor: newCurrentContributorId
        },
        lastUpdated: getCurrentServerTimestampInMillis()
    })

    // Send txs.
    await batch.commit()

    printLog(`Coordinate successfully completed`, LogLevel.DEBUG)
}

/**
 * This method is used to coordinate the waiting queues of ceremony circuits.
 * @dev this cloud function is triggered whenever an update of a document related to a participant of a ceremony occurs.
 * The function verifies that such update is preparatory towards a waiting queue update for one or more circuits in the ceremony.
 * If that's the case, this cloud functions proceeds with the "coordination" of the waiting queues, leading to three different scenarios:
 * A) The participant becomes the current contributor of circuit X (single participant).
 * B) The participant is placed in the contribution waiting queue because someone else is currently contributing to circuit X (single participant)
 * C) The participant is removed as current contributor from Circuit X and gets coordinated for Circuit X + 1 (multi-participant).
 *    C.1) The first participant in the waiting queue for Circuit X (if any), becomes the new contributor for circuit X.
 * Before triggering the above scenarios, the cloud functions verifies that suitable pre-conditions are met.
 * @notice The cloud function performs the subsequent steps:
 * 0) Prepares the participant's previous and current data (after/before document change).
 * 1) Retrieve the ceremony from the participant's document path.
 * 2) Verifies that the participant has changed to a state for which it is ready for contribution.
 * 2.A) If ready, verifies whether the participant is ready to:
 * - Contribute for the first time or for the next circuit (other than the first) or contribute after a timeout has expired. If yes, coordinate (single participant scenario).
 * 2.B) Otherwise, check whether the participant has:
 * - Just completed a contribution or all contributions for each circuit. If yes, coordinate (multi-participant scenario).
 */
export const coordinateCeremonyParticipant = functionsV1.firestore
    .document(
        `${commonTerms.collections.ceremonies.name}/{ceremonyId}/${commonTerms.collections.participants.name}/{participantId}`
    )
    .onUpdate(async (participantChanges: Change<QueryDocumentSnapshot>) => {
        // Step (0).
        const exParticipant = participantChanges.before
        const changedParticipant = participantChanges.after

        if (!exParticipant.data() || !changedParticipant.data())
            logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

        // Step (1).
        const ceremonyId = exParticipant.ref.parent.parent!.path.replace(
            `${commonTerms.collections.ceremonies.name}/`,
            ""
        )

        if (!ceremonyId) logAndThrowError(COMMON_ERRORS.CM_INVALID_CEREMONY_FOR_PARTICIPANT)

        // Extract data.
        const {
            contributionProgress: exContributionProgress,
            status: exStatus,
            contributionStep: exContributionStep
        } = exParticipant.data()!

        const {
            contributionProgress: changedContributionProgress,
            status: changedStatus,
            contributionStep: changedContributionStep
        } = changedParticipant.data()!

        printLog(`Coordinate participant ${exParticipant.id} for ceremony ${ceremonyId}`, LogLevel.DEBUG)
        printLog(
            `Participant status: ${exStatus} => ${changedStatus} - Participant contribution step: ${exContributionStep} => ${changedContributionStep}`,
            LogLevel.DEBUG
        )

        // Define pre-conditions.
        const participantReadyToContribute = changedStatus === ParticipantStatus.READY

        const participantReadyForFirstContribution = participantReadyToContribute && exContributionProgress === 0

        const participantResumingContributionAfterTimeout =
            participantReadyToContribute && exContributionProgress === changedContributionProgress

        const participantReadyForNextContribution =
            participantReadyToContribute &&
            exContributionProgress === changedContributionProgress - 1 &&
            exContributionProgress !== 0

        const participantCompletedEveryCircuitContribution =
            changedStatus === ParticipantStatus.DONE && exStatus !== ParticipantStatus.DONE

        const participantCompletedContribution =
            exContributionProgress === changedContributionProgress &&
            exStatus === ParticipantStatus.CONTRIBUTING &&
            exContributionStep === ParticipantContributionStep.VERIFYING &&
            changedStatus === ParticipantStatus.CONTRIBUTED &&
            changedContributionStep === ParticipantContributionStep.COMPLETED

        // Step (2).
        if (
            participantReadyForFirstContribution ||
            participantResumingContributionAfterTimeout ||
            participantReadyForNextContribution
        ) {
            // Step (2.A).
            printLog(
                `Participant is ready for first contribution (${participantReadyForFirstContribution}) or for the next contribution (${participantReadyForNextContribution}) or is resuming after a timeout expiration (${participantResumingContributionAfterTimeout})`,
                LogLevel.DEBUG
            )

            // Get the circuit.
            const circuit = await getCircuitDocumentByPosition(ceremonyId, changedContributionProgress)

            // Coordinate.
            await coordinate(changedParticipant, circuit, true)

            printLog(`Coordination for circuit ${circuit.id} completed`, LogLevel.DEBUG)
        } else if (participantCompletedContribution || participantCompletedEveryCircuitContribution) {
            // Step (2.B).
            printLog(
                `Participant completed a contribution (${participantCompletedContribution}) or every contribution for each circuit (${participantCompletedEveryCircuitContribution})`,
                LogLevel.DEBUG
            )

            // Get the circuit.
            const circuit = await getCircuitDocumentByPosition(ceremonyId, exContributionProgress)

            // Coordinate.
            await coordinate(changedParticipant, circuit, false, ceremonyId)

            printLog(`Coordination for circuit ${circuit.id} completed`, LogLevel.DEBUG)
        }
    })

/// @todo needs refactoring below.

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
