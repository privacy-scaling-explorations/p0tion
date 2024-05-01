import { Injectable } from "@nestjs/common"
import { CreateCeremonyDto } from "../dto/create-ceremony-dto"
import { InjectModel } from "@nestjs/sequelize"
import { CeremonyEntity } from "../entities/ceremony.entity"

@Injectable()
export class CeremoniesService {
    constructor(
        @InjectModel(CeremonyEntity)
        private ceremonyModel: typeof CeremonyEntity
    ) {}

    create(createCeremonyDto: CreateCeremonyDto) {
        return this.ceremonyModel.create(createCeremonyDto as any)
    }

    findById(id: number) {
        return this.ceremonyModel.findByPk(id)
    }
}
