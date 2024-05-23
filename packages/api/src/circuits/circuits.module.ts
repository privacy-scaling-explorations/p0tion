import { Module } from "@nestjs/common"
import { CircuitsController } from "./controller/circuits.controller"
import { CircuitsService } from "./service/circuits.service"
import { SequelizeModule } from "@nestjs/sequelize"
import { CircuitEntity } from "./entities/circuit.entity"
import { CeremoniesService } from "src/ceremonies/service/ceremonies.service"
import { CeremonyEntity } from "src/ceremonies/entities/ceremony.entity"

@Module({
    controllers: [CircuitsController],
    providers: [CircuitsService, CeremoniesService],
    imports: [SequelizeModule.forFeature([CircuitEntity, CeremonyEntity])],
    exports: [SequelizeModule]
})
export class CircuitsModule {}
