import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/sequelize"
import { ParticipantEntity } from "../entities/participant.entity"
import { ParticipantStatus } from "@p0tion/actions"
import { COMMON_ERRORS, SPECIFIC_ERRORS, logAndThrowError, printLog } from "src/lib/errors"
import { LogLevel } from "src/types/enums"

@Injectable()
export class ParticipantsService {
    constructor(
        @InjectModel(ParticipantEntity)
        private participantModel: typeof ParticipantEntity
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
}
