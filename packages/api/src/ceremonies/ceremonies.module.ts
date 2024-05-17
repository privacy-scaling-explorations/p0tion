import { Module } from "@nestjs/common"
import { CeremoniesController } from "./controller/ceremonies.controller"
import { CeremoniesService } from "./service/ceremonies.service"
import { SequelizeModule } from "@nestjs/sequelize"
import { CeremonyEntity } from "./entities/ceremony.entity"
import { CircuitEntity } from "./entities/circuit.entity"
import { UsersService } from "src/users/service/users.service"
import { UserEntity } from "src/users/entities/user.entity"
import { ParticipantEntity } from "./entities/participant.entity"

@Module({
    controllers: [CeremoniesController],
    providers: [CeremoniesService, UsersService],
    imports: [SequelizeModule.forFeature([CeremonyEntity, CircuitEntity, ParticipantEntity, UserEntity])],
    exports: [SequelizeModule]
})
export class CeremoniesModule {}
