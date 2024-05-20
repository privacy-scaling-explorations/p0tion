import { Module } from "@nestjs/common"
import { ParticipantsController } from "./controller/participants.controller"
import { ParticipantsService } from "./service/participants.service"
import { CeremoniesService } from "src/ceremonies/service/ceremonies.service"
import { SequelizeModule } from "@nestjs/sequelize"
import { CeremonyEntity } from "src/ceremonies/entities/ceremony.entity"
import { CircuitsService } from "src/circuits/service/circuits.service"
import { CircuitEntity } from "src/circuits/entities/circuit.entity"
import { ParticipantEntity } from "./entities/participant.entity"

@Module({
    controllers: [ParticipantsController],
    providers: [ParticipantsService, CeremoniesService, CircuitsService],
    imports: [SequelizeModule.forFeature([CeremonyEntity, CircuitEntity, ParticipantEntity])]
})
export class ParticipantsModule {}
