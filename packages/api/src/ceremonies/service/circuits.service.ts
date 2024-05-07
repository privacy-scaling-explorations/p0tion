import { Injectable } from "@nestjs/common"
import { CircuitEntity } from "../entities/circuit.entity"
import { InjectModel } from "@nestjs/sequelize"

@Injectable()
export class CircuitsService {
    constructor(
        @InjectModel(CircuitEntity)
        private circuitModel: typeof CircuitEntity
    ) {}

    async create(circuits) {
        const circuitEntities = []
        for (let i = 0, ni = circuits.length; i < ni; i++) {
            const circuit = circuits[i]
            const circuitEntity = await this.circuitModel.create(circuit)
            circuitEntities.push(circuitEntity)
        }
        return circuitEntities
    }
}
