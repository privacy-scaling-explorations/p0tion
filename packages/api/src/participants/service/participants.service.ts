import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/sequelize"
import { CeremoniesService } from "src/ceremonies/service/ceremonies.service"
import { ParticipantEntity } from "../entities/participant.entity"
import { COMMON_ERRORS, SPECIFIC_ERRORS, logAndThrowError, printLog } from "src/lib/errors"
import { CeremonyState, ParticipantContributionStep, ParticipantStatus } from "@p0tion/actions"
import { LogLevel } from "src/types/enums"
import { CircuitsService } from "src/circuits/service/circuits.service"
import { getCurrentServerTimestampInMillis } from "src/lib/utils"
import { PermanentlyStoreCurrentContributionTimeAndHash } from "../dto/participants-dto"

@Injectable()
export class ParticipantsService {
    constructor(
        @InjectModel(ParticipantEntity)
        private participantModel: typeof ParticipantEntity,
        private readonly ceremoniesService: CeremoniesService,
        private readonly circuitsService: CircuitsService
    ) {}

    findParticipantOfCeremony(userId: string, ceremonyId: number) {
        return this.participantModel.findOne({ where: { userId, ceremonyId } })
    }

    updateByUserIdAndCeremonyId(userId: string, ceremonyId: number, data: Partial<ParticipantEntity>) {
        return this.participantModel.update(data, { where: { userId, ceremonyId } })
    }

    create(data: Partial<ParticipantEntity>) {
        return this.participantModel.create(data)
    }

    findById(userId: string, ceremonyId: number) {
        return this.participantModel.findOne({ where: { userId, ceremonyId } })
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
            participant.update({ status: ParticipantStatus.READY, tempContributionData: {} })
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
            return true
        }
        // Check (1.B).
        const { contributionProgress, contributionStep, contributions, status, tempContributionData } = participant
        const circuits = await this.circuitsService.getCircuitsOfCeremony(ceremonyId)
        // Check (2.A).
        if (contributionProgress === circuits.length && status === ParticipantStatus.DONE) {
            // Action (3.A).
            printLog(`Contributor ${participant.userId} has already contributed to all circuits`, LogLevel.DEBUG)

            return false
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
                participant.update({
                    status: ParticipantStatus.EXHUMED,
                    contributions,
                    tempContributionData: tempContributionData,
                    contributionStep: ParticipantContributionStep.DOWNLOADING,
                    contributionStartedAt: 0,
                    verificationStartedAt: null
                })

                printLog(`Timeout expired for participant ${participant.id}`, LogLevel.DEBUG)

                return true
            }

            // Action (3.C).
            printLog(`Timeout still in effect for the participant ${participant.userId}`, LogLevel.DEBUG)

            return false
        }

        // Check (2.C).
        if (staleContributionData && wasComputing) {
            // nb. stale contribution data is always the latest contribution.
            contributions.pop()
            participant.update({
                contributions
            })
            printLog(`Removed stale contribution data for ${participant.userId}`, LogLevel.DEBUG)
        }

        // Action (1.D).
        return true
    }
}
