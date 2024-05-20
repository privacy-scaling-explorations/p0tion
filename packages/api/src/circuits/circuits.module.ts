import { Module } from "@nestjs/common"
import { CircuitsController } from "./controller/circuits.controller"
import { CircuitsService } from "./service/circuits.service"
import { SequelizeModule } from "@nestjs/sequelize"
import { CircuitEntity } from "./entities/circuit.entity"

@Module({
    controllers: [CircuitsController],
    providers: [CircuitsService],
    imports: [SequelizeModule.forFeature([CircuitEntity])]
})
export class CircuitsModule {}
