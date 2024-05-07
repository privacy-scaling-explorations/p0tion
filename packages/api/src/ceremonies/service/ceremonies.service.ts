import { Injectable } from "@nestjs/common"
import { CeremonyDto } from "../dto/ceremony-dto"
import { InjectModel } from "@nestjs/sequelize"
import { CeremonyEntity } from "../entities/ceremony.entity"
import { CircuitEntity } from "../entities/circuit.entity"
import { CircuitDto } from "../dto/circuit-dto"

@Injectable()
export class CeremoniesService {
    constructor(
        @InjectModel(CeremonyEntity)
        private ceremonyModel: typeof CeremonyEntity,
        @InjectModel(CircuitEntity)
        private circuitModel: typeof CircuitEntity
    ) {}

    async create(ceremonyDto: CeremonyDto) {
        const { circuits, ...ceremonyData } = ceremonyDto

        const ceremony = await this.ceremonyModel.create(ceremonyData as any)

        const circuitEntities = await this.createCircuits(circuits, ceremony.id)
        await ceremony.$set("circuits", circuitEntities)
        return ceremony
    }

    async createCircuits(circuits: CircuitDto[], ceremonyId: number) {
        const circuitEntities = []
        for (let i = 0, ni = circuits.length; i < ni; i++) {
            const circuit = circuits[i]
            const circuitEntity = await this.circuitModel.create({ ...circuit, ceremonyId })
            circuitEntities.push(circuitEntity)
        }
        return circuitEntities
    }

    findById(id: number) {
        return this.ceremonyModel.findByPk(id, { include: [CircuitEntity] })
    }
}
