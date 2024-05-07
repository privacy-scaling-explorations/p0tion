import { Module } from "@nestjs/common"
import { CeremoniesController } from "./controller/ceremonies.controller"
import { CeremoniesService } from "./service/ceremonies.service"
import { SequelizeModule } from "@nestjs/sequelize"
import { CeremonyEntity } from "./entities/ceremony.entity"
import { CircuitEntity } from "./entities/circuit.entity"

@Module({
    controllers: [CeremoniesController],
    providers: [CeremoniesService],
    imports: [SequelizeModule.forFeature([CeremonyEntity, CircuitEntity])],
    exports: [SequelizeModule]
})
export class CeremoniesModule {}
