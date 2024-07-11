import { Inject, Injectable, forwardRef } from "@nestjs/common"
import { InjectModel } from "@nestjs/sequelize"
import { CeremoniesService } from "src/ceremonies/service/ceremonies.service"
import { ParticipantEntity } from "../entities/participant.entity"
import { COMMON_ERRORS, SPECIFIC_ERRORS, logAndThrowError, printLog } from "src/lib/errors"
import { CeremonyState, ParticipantContributionStep, ParticipantStatus } from "@p0tion/actions"
import { LogLevel } from "src/types/enums"
import { CircuitsService } from "src/circuits/service/circuits.service"
import { getCurrentServerTimestampInMillis } from "src/lib/utils"
import {
    PermanentlyStoreCurrentContributionTimeAndHash,
    TemporaryStoreCurrentContributionMultiPartUploadId
} from "../dto/participants-dto"
import { TemporaryStoreCurrentContributionUploadedChunkData } from "src/storage/dto/storage-dto"
import { Cron, CronExpression } from "@nestjs/schedule"
import { CircuitEntity } from "src/circuits/entities/circuit.entity"
import { Sequelize } from "sequelize-typescript"

@Injectable()
export class ParticipantsService {
    constructor(
        private sequelize: Sequelize,
        @InjectModel(ParticipantEntity)
        private participantModel: typeof ParticipantEntity,
        @Inject(forwardRef(() => CeremoniesService))
        private readonly ceremoniesService: CeremoniesService,
        @Inject(forwardRef(() => CircuitsService))
        private readonly circuitsService: CircuitsService
    ) {}

    findParticipantOfCeremony(userId: string, ceremonyId: number) {
        return this.participantModel.findOne({ where: { userId, ceremonyId } })
    }

    findCurrentParticipantOfCeremony(ceremonyId: number) {
        return this.participantModel.findOne({ where: { ceremonyId, status: ParticipantStatus.CONTRIBUTING } })
    }

    findById(userId: string, ceremonyId: number) {
        return this.participantModel.findOne({ where: { userId, ceremonyId } })
    }

    async findCurrentActiveParticipantTimeout(ceremonyId: number, participantId: string) {
        const { timeout } = await this.participantModel.findOne({ where: { ceremonyId, userId: participantId } })
        const result = timeout.find((timeout) => timeout.endDate >= getCurrentServerTimestampInMillis())
        return { timeout: result }
    }

    async findAllParticipantsByCeremonyId(ceremonyId: number) {
        const participants = await this.participantModel.findAll({ where: { ceremonyId } })
        return { participants }
    }

    updateByUserIdAndCeremonyId(userId: string, ceremonyId: number, data: Partial<ParticipantEntity>) {
        return this.participantModel.update(data, { where: { userId, ceremonyId } })
    }

    create(data: Partial<ParticipantEntity>) {
        return this.participantModel.create(data)
    }

    async queryNotExpiredTimeouts(ceremonyId: number, userId: string) {
        const participant = await this.findParticipantOfCeremony(userId, ceremonyId)
        if (!participant) {
            return []
        }
        return participant.timeout.filter((timeout) => timeout.endDate >= getCurrentServerTimestampInMillis())
    }

    async resumeContributionAfterTimeoutExpiration(ceremonyId: number, userId: string) {
        const participant = await this.findParticipantOfCeremony(userId, ceremonyId)
        if (!participant) {
            logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)
        }
        const { contributionProgress, status } = participant
        if (status === ParticipantStatus.EXHUMED) {
            await participant.update({ status: ParticipantStatus.READY, tempContributionData: {} })
        } else {
            logAndThrowError(SPECIFIC_ERRORS.SE_CONTRIBUTE_CANNOT_PROGRESS_TO_NEXT_CIRCUIT)
        }
        printLog(
            `Contributor ${userId} can retry the contribution for the circuit in position ${
                contributionProgress + 1
            } after timeout expiration`,
            LogLevel.DEBUG
        )
    }

    async checkParticipantForCeremony(ceremonyId: number, userId: string) {
        const ceremony = await this.ceremoniesService.findById(ceremonyId)
        const participant = await this.findParticipantOfCeremony(userId, ceremonyId)
        // Check pre-condition (ceremony state opened).
        if (ceremony.state !== CeremonyState.OPENED) {
            logAndThrowError(SPECIFIC_ERRORS.SE_PARTICIPANT_CEREMONY_NOT_OPENED)
        }

        // Check (1).
        if (!participant) {
            // Action (1.A).
            // Register user as participant.
            await this.participantModel.create({
                userId,
                ceremonyId,
                contributionProgress: 0,
                status: ParticipantStatus.WAITING,
                contributions: [],
                contributionStartedAt: 0
            })
            printLog(
                `The user ${userId} has been registered as participant for ceremony ${ceremony.id}`,
                LogLevel.DEBUG
            )
            return { canContribute: true }
        }
        // Check (1.B).
        const { contributionProgress, contributionStep, contributions, status, tempContributionData } = participant
        const circuits = await this.circuitsService.getCircuitsOfCeremony(ceremonyId)
        // Check (2.A).
        if (contributionProgress === circuits.length && status === ParticipantStatus.DONE) {
            // Action (3.A).
            printLog(`Contributor ${participant.userId} has already contributed to all circuits`, LogLevel.DEBUG)

            return { canContribute: false }
        }

        // Pre-conditions.
        const staleContributionData = contributionProgress >= 1 && contributions.length === contributionProgress
        const wasComputing = !!contributionStep && contributionStep === ParticipantContributionStep.COMPUTING

        // Check (2.B).
        if (status === ParticipantStatus.TIMEDOUT) {
            // Query for not expired timeouts.
            const notExpiredTimeouts = await this.queryNotExpiredTimeouts(ceremony.id, participant.userId)
            if (!notExpiredTimeouts || notExpiredTimeouts.length === 0) {
                // nb. stale contribution data is always the latest contribution.
                if (staleContributionData) contributions.pop()

                // Action (3.B).
                await participant.update({
                    status: ParticipantStatus.EXHUMED,
                    contributions,
                    tempContributionData: tempContributionData,
                    contributionStep: ParticipantContributionStep.DOWNLOADING,
                    contributionStartedAt: 0,
                    verificationStartedAt: null
                })

                printLog(`Timeout expired for participant ${participant.id}`, LogLevel.DEBUG)

                return { canContribute: true }
            }

            // Action (3.C).
            printLog(`Timeout still in effect for the participant ${participant.userId}`, LogLevel.DEBUG)

            return { canContribute: false }
        }

        // Check (2.C).
        if (staleContributionData && wasComputing) {
            // nb. stale contribution data is always the latest contribution.
            contributions.pop()
            await participant.update({
                contributions
            })
            printLog(`Removed stale contribution data for ${participant.userId}`, LogLevel.DEBUG)
        }

        // Action (1.D).
        return { canContribute: true }
    }

    async progressToNextCircuitForContribution(ceremonyId: number, userId: string) {
        const participant = await this.findParticipantOfCeremony(userId, ceremonyId)
        if (!participant) {
            logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)
        }
        const { contributionProgress, contributionStep, status } = participant

        // Define pre-conditions.
        const waitingToBeQueuedForFirstContribution = status === ParticipantStatus.WAITING && contributionProgress === 0
        const completedContribution =
            status === ParticipantStatus.CONTRIBUTED &&
            contributionStep === ParticipantContributionStep.COMPLETED &&
            contributionProgress !== 0

        // Check pre-conditions (1) or (2).
        if (completedContribution || waitingToBeQueuedForFirstContribution) {
            await participant.update({
                contributionProgress: contributionProgress + 1,
                status: ParticipantStatus.READY
            })
        } else {
            logAndThrowError(SPECIFIC_ERRORS.SE_CONTRIBUTE_CANNOT_PROGRESS_TO_NEXT_CIRCUIT)
        }

        printLog(
            `Participant/Contributor ${userId} progress to the circuit in position ${contributionProgress + 1}`,
            LogLevel.DEBUG
        )
    }

    async progressToNextContributionStep(ceremonyId: number, userId: string) {
        const ceremony = await this.ceremoniesService.findById(ceremonyId)
        const participant = await this.findParticipantOfCeremony(userId, ceremonyId)

        // Extract data.
        const { state } = ceremony
        const { status, contributionStep } = participant

        // Pre-condition: ceremony must be opened.
        if (state !== CeremonyState.OPENED) logAndThrowError(SPECIFIC_ERRORS.SE_PARTICIPANT_CEREMONY_NOT_OPENED)

        // Pre-condition: participant has contributing status.
        if (status !== ParticipantStatus.CONTRIBUTING) logAndThrowError(SPECIFIC_ERRORS.SE_PARTICIPANT_NOT_CONTRIBUTING)

        // Prepare the next contribution step.
        let nextContributionStep = contributionStep

        if (contributionStep === ParticipantContributionStep.DOWNLOADING)
            nextContributionStep = ParticipantContributionStep.COMPUTING
        else if (contributionStep === ParticipantContributionStep.COMPUTING)
            nextContributionStep = ParticipantContributionStep.UPLOADING
        else if (contributionStep === ParticipantContributionStep.UPLOADING)
            nextContributionStep = ParticipantContributionStep.VERIFYING
        else if (contributionStep === ParticipantContributionStep.VERIFYING)
            nextContributionStep = ParticipantContributionStep.COMPLETED

        await participant.update({
            contributionStep: nextContributionStep,
            verificationStartedAt:
                nextContributionStep === ParticipantContributionStep.VERIFYING ? getCurrentServerTimestampInMillis() : 0
        })

        printLog(`Participant ${userId} advanced to ${nextContributionStep} contribution step`, LogLevel.DEBUG)
    }

    async permanentlyStoreCurrentContributionTimeAndHash(
        ceremonyId: number,
        userId: string,
        data: PermanentlyStoreCurrentContributionTimeAndHash
    ) {
        const participant = await this.findParticipantOfCeremony(userId, ceremonyId)
        const isCoordinator = await this.ceremoniesService.findCoordinatorOfCeremony(userId, ceremonyId)

        // Extract data.
        const { status, contributionStep, contributions: currentContributions } = participant

        // Pre-condition: computing contribution step or finalizing (only for coordinator when finalizing ceremony).
        if (
            contributionStep === ParticipantContributionStep.COMPUTING ||
            (isCoordinator && status === ParticipantStatus.FINALIZING)
        ) {
            await participant.update({
                contributions: [
                    ...currentContributions,
                    {
                        hash: data.contributionHash,
                        computationTime: data.contributionComputationTime
                    }
                ]
            })
        } else {
            logAndThrowError(SPECIFIC_ERRORS.SE_PARTICIPANT_CANNOT_STORE_PERMANENT_DATA)
        }

        printLog(
            `Participant ${userId} has successfully stored the contribution hash ${data.contributionHash} and computation time ${data.contributionComputationTime}`,
            LogLevel.DEBUG
        )
    }

    async temporaryStoreCurrentContributionMultipartUploadId(
        ceremonyId: number,
        userId: string,
        data: TemporaryStoreCurrentContributionMultiPartUploadId
    ) {
        const participant = await this.findParticipantOfCeremony(userId, ceremonyId)
        const { uploadId } = data

        // Extract data.
        const { contributionStep, tempContributionData: currentTempContributionData } = participant

        // Pre-condition: check if the current contributor has uploading contribution step.
        if (contributionStep !== ParticipantContributionStep.UPLOADING) {
            logAndThrowError(SPECIFIC_ERRORS.SE_PARTICIPANT_CANNOT_STORE_TEMPORARY_DATA)
        }

        await participant.update({
            tempContributionData: {
                ...currentTempContributionData,
                uploadId,
                chunks: []
            }
        })

        printLog(
            `Participant ${userId} has successfully stored the temporary data for ${uploadId} multi-part upload`,
            LogLevel.DEBUG
        )
    }

    async temporaryStoreCurrentContributionUploadedChunkData(
        ceremonyId: number,
        userId: string,
        data: TemporaryStoreCurrentContributionUploadedChunkData
    ) {
        const participant = await this.findParticipantOfCeremony(userId, ceremonyId)
        const { chunk } = data

        // Extract data.
        const { contributionStep, tempContributionData: currentTempContributionData } = participant

        // Pre-condition: check if the current contributor has uploading contribution step.
        if (contributionStep !== ParticipantContributionStep.UPLOADING)
            logAndThrowError(SPECIFIC_ERRORS.SE_PARTICIPANT_CANNOT_STORE_TEMPORARY_DATA)

        // Get already uploaded chunks.
        const chunks = currentTempContributionData.chunks ? currentTempContributionData.chunks : []

        // Push last chunk.
        chunks.push(chunk)

        // Update.
        await participant.update({
            tempContributionData: {
                ...currentTempContributionData,
                chunks
            }
        })

        printLog(
            `Participant ${userId} has successfully stored the temporary uploaded chunk data: ETag ${chunk.ETag} and PartNumber ${chunk.PartNumber}`,
            LogLevel.DEBUG
        )
    }

    async checkAndPrepareCoordinatorForFinalization(ceremonyId: number, userId: string) {
        const ceremony = await this.ceremoniesService.findById(ceremonyId)
        const participant = await this.findParticipantOfCeremony(userId, ceremonyId)
        const circuits = await this.circuitsService.getCircuitsOfCeremony(ceremonyId)

        const { state } = ceremony
        const { contributionProgress, status } = participant
        // Check pre-conditions.
        if (
            state === CeremonyState.CLOSED &&
            status === ParticipantStatus.DONE &&
            contributionProgress === circuits.length
        ) {
            // Make coordinator ready for finalization.
            await participant.update({
                status: ParticipantStatus.FINALIZING
            })

            printLog(`The coordinator ${userId} is now ready to finalize the ceremony ${ceremonyId}.`, LogLevel.DEBUG)

            return true
        }
        printLog(`The coordinator ${userId} is not ready to finalize the ceremony ${ceremonyId}.`, LogLevel.DEBUG)

        return false
    }

    async coordinate(
        participant: ParticipantEntity,
        circuit: CircuitEntity,
        isSingleParticipantCoordination: boolean,
        ceremonyId?: number
    ) {
        // Extract data.
        const { status, contributionStep, userId } = participant
        const { waitingQueue } = circuit
        const { contributors, currentContributor } = waitingQueue

        // Prepare state updates for waiting queue.
        const newContributors = contributors
        let newCurrentContributorId: string = ""

        // Prepare state updates for participant.
        let newParticipantStatus: string = ""
        let newContributionStep: string = ""

        // Prepare pre-conditions.
        const noCurrentContributor = !currentContributor
        const noContributorsInWaitingQueue = !contributors.length
        const emptyWaitingQueue = noCurrentContributor && noContributorsInWaitingQueue

        const participantIsNotCurrentContributor = currentContributor !== userId
        const participantIsCurrentContributor = currentContributor === userId
        const participantIsReady = status === ParticipantStatus.READY
        const participantResumingAfterTimeoutExpiration = participantIsCurrentContributor && participantIsReady

        const participantCompletedOneOrAllContributions =
            (status === ParticipantStatus.CONTRIBUTED || status === ParticipantStatus.DONE) &&
            contributionStep === ParticipantContributionStep.COMPLETED

        try {
            await this.sequelize.transaction(async (t) => {
                const transactionHost = { transaction: t }

                // Check for scenarios.
                if (isSingleParticipantCoordination) {
                    // Scenario (A).
                    if (emptyWaitingQueue) {
                        printLog(`Coordinate - executing scenario A - emptyWaitingQueue`, LogLevel.DEBUG)

                        // Update.
                        newCurrentContributorId = userId
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
                        newCurrentContributorId = userId
                    }
                    // Scenario (B).
                    else if (participantIsNotCurrentContributor) {
                        printLog(
                            `Coordinate - executing scenario B - single - participantIsNotCurrentContributor`,
                            LogLevel.DEBUG
                        )

                        newCurrentContributorId = currentContributor
                        newParticipantStatus = ParticipantStatus.WAITING
                        newContributors.push(userId)
                    }

                    // Prepare tx - Scenario (A) only.
                    if (newContributionStep) {
                        await participant.update(
                            {
                                contributionStep: newContributionStep
                            },
                            transactionHost
                        )
                    }
                    // Prepare tx - Scenario (A) or (B).
                    await participant.update(
                        {
                            status: newParticipantStatus,
                            contributionStartedAt:
                                newParticipantStatus === ParticipantStatus.CONTRIBUTING
                                    ? getCurrentServerTimestampInMillis()
                                    : 0
                        },
                        transactionHost
                    )
                } else if (
                    participantIsCurrentContributor &&
                    participantCompletedOneOrAllContributions &&
                    !!ceremonyId
                ) {
                    printLog(
                        `Coordinate - executing scenario C - multi - participantIsCurrentContributor && participantCompletedOneOrAllContributions`,
                        LogLevel.DEBUG
                    )

                    newParticipantStatus = ParticipantStatus.CONTRIBUTING
                    newContributionStep = ParticipantContributionStep.DOWNLOADING

                    // Remove from waiting queue of circuit X.
                    newContributors.shift()

                    // Step (C.1).
                    if (newContributors.length > 0) {
                        // Get new contributor for circuit X.
                        newCurrentContributorId = newContributors.at(0)!

                        const newCurrentParticipant = await this.findById(newCurrentContributorId, ceremonyId)
                        await newCurrentParticipant.update(
                            {
                                status: newParticipantStatus,
                                contributionStep: newContributionStep,
                                contributionStartedAt: getCurrentServerTimestampInMillis()
                            },
                            transactionHost
                        )

                        printLog(
                            `Participant ${newCurrentContributorId} is the new current contributor for circuit ${circuit.id}`,
                            LogLevel.DEBUG
                        )
                    }
                }

                await circuit.update(
                    {
                        waitingQueue: {
                            ...waitingQueue,
                            contributors: newContributors,
                            currentContributor: newCurrentContributorId
                        }
                    },
                    transactionHost
                )
                printLog(`Coordinate successfully completed`, LogLevel.DEBUG)
            })
        } catch (error) {
            printLog(
                `There was an error running the coordinate function with participant ${userId} in ceremony: ${ceremonyId}`,
                LogLevel.DEBUG
            )
        }
    }

    @Cron(CronExpression.EVERY_30_SECONDS)
    async coordinateCeremonyParticipant() {
        const ceremonies = await this.ceremoniesService.findAll()
        ceremonies.forEach(async (ceremony) => {
            const participants = ceremony.participants
            participants.forEach(async (participant) => {
                const { userId, contributionProgress, status, contributionStep } = participant

                printLog(`Coordinate participant ${userId} for ceremony ${ceremony.id}`, LogLevel.DEBUG)
                printLog(
                    `Participant status: ${status} - Participant contribution step: ${contributionStep}`,
                    LogLevel.DEBUG
                )

                // Define pre-conditions.
                const participantReadyToContribute = status === ParticipantStatus.READY

                const participantReadyForFirstContribution = participantReadyToContribute && contributionProgress === 0

                const participantResumingContributionAfterTimeout = participantReadyToContribute // && prevContributionProgress === changedContributionProgress

                const participantReadyForNextContribution = participantReadyToContribute && contributionProgress !== 0
                // && prevContributionProgress === changedContributionProgress - 1

                const participantCompletedEveryCircuitContribution = status === ParticipantStatus.DONE // && prevStatus !== ParticipantStatus.DONE

                const participantCompletedContribution =
                    status === ParticipantStatus.CONTRIBUTED &&
                    contributionStep === ParticipantContributionStep.COMPLETED
                // prevContributionProgress === changedContributionProgress &&
                // prevStatus === ParticipantStatus.CONTRIBUTING &&
                // prevContributionStep === ParticipantContributionStep.VERIFYING &&

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
                    const { circuit } = await this.circuitsService.getCircuitById(ceremony.id, contributionProgress)

                    // Coordinate.
                    await this.coordinate(participant, circuit, true)

                    printLog(`Coordination for circuit ${circuit.id} completed`, LogLevel.DEBUG)
                } else if (participantCompletedContribution || participantCompletedEveryCircuitContribution) {
                    // Step (2.B).
                    printLog(
                        `Participant completed a contribution (${participantCompletedContribution}) or every contribution for each circuit (${participantCompletedEveryCircuitContribution})`,
                        LogLevel.DEBUG
                    )

                    // Get the circuit.
                    const { circuit } = await this.circuitsService.getCircuitById(ceremony.id, contributionProgress - 1)

                    // Coordinate.
                    await this.coordinate(participant, circuit, false, ceremony.id)

                    printLog(`Coordination for circuit ${circuit.id} completed`, LogLevel.DEBUG)
                }
            })
        })
    }
}
