import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/sequelize"
import { ParticipantEntity } from "../entities/participant.entity"

@Injectable()
export class ParticipantsService {
    constructor(
        @InjectModel(ParticipantEntity)
        private participantModel: typeof ParticipantEntity
    ) {}

    findParticipantOfCeremony(userId: string, ceremonyId: number) {
        return this.participantModel.findOne({ where: { userId, ceremonyId } })
    }

    updateById(id: number, data: Partial<ParticipantEntity>) {
        return this.participantModel.update(data, { where: { id } })
    }
}
