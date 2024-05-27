import { Module } from "@nestjs/common"
import { CircuitsController } from "./controller/circuits.controller"
import { CircuitsService } from "./service/circuits.service"
import { SequelizeModule } from "@nestjs/sequelize"
import { CircuitEntity } from "./entities/circuit.entity"
import { CeremoniesService } from "src/ceremonies/service/ceremonies.service"
import { CeremonyEntity } from "src/ceremonies/entities/ceremony.entity"
import { ContributionEntity } from "./entities/contribution.entity"
import { ParticipantsService } from "src/participants/service/participants.service"
import { ParticipantEntity } from "src/participants/entities/participant.entity"

@Module({
    controllers: [CircuitsController],
    providers: [CircuitsService, CeremoniesService, ParticipantsService],
    imports: [SequelizeModule.forFeature([CircuitEntity, CeremonyEntity, ContributionEntity, ParticipantEntity])],
    exports: [SequelizeModule]
})
export class CircuitsModule {}
