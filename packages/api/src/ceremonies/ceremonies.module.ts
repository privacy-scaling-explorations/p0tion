import { Module } from "@nestjs/common"
import { CeremoniesController } from "./controller/ceremonies.controller"
import { CeremoniesService } from "./service/ceremonies.service"
import { SequelizeModule } from "@nestjs/sequelize"
import { CeremonyEntity } from "./entities/ceremony.entity"
import { CircuitEntity } from "./entities/circuit.entity"
import { CircuitsController } from "./controller/circuits.controller"
import { CircuitsService } from "./service/circuits.service"

@Module({
    controllers: [CeremoniesController, CircuitsController],
    providers: [CeremoniesService, CircuitsService],
    imports: [SequelizeModule.forFeature([CeremonyEntity, CircuitEntity])],
    exports: [SequelizeModule]
})
export class CeremoniesModule {}
