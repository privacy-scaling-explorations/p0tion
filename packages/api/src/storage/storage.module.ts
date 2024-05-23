import { Module } from "@nestjs/common"
import { StorageController } from "./controller/storage.controller"
import { StorageService } from "./service/storage.service"
import { UsersService } from "src/users/service/users.service"
import { UserEntity } from "src/users/entities/user.entity"
import { SequelizeModule } from "@nestjs/sequelize"
import { CeremoniesService } from "src/ceremonies/service/ceremonies.service"
import { CeremonyEntity } from "src/ceremonies/entities/ceremony.entity"
import { ParticipantEntity } from "src/participants/entities/participant.entity"
import { CircuitsService } from "src/circuits/service/circuits.service"
import { CircuitEntity } from "src/circuits/entities/circuit.entity"
import { ParticipantsService } from "src/participants/service/participants.service"

@Module({
    controllers: [StorageController],
    imports: [SequelizeModule.forFeature([UserEntity, CeremonyEntity, CircuitEntity, ParticipantEntity])],
    providers: [StorageService, UsersService, CeremoniesService, CircuitsService, ParticipantsService],
    exports: [SequelizeModule]
})
export class StorageModule {}
