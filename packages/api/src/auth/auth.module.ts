import { Module } from "@nestjs/common"
import { AuthController } from "./controller/auth.controller"
import { AuthService } from "./service/auth.service"
import { SequelizeModule } from "@nestjs/sequelize"
import { UserEntity } from "src/users/entities/user.entity"
import { UsersService } from "src/users/service/users.service"
import { CeremoniesService } from "src/ceremonies/service/ceremonies.service"
import { CeremonyEntity } from "src/ceremonies/entities/ceremony.entity"
import { ParticipantEntity } from "src/participants/entities/participant.entity"
import { CircuitsService } from "src/circuits/service/circuits.service"
import { CircuitEntity } from "src/circuits/entities/circuit.entity"

@Module({
    imports: [SequelizeModule.forFeature([UserEntity, CeremonyEntity, CircuitEntity, ParticipantEntity])],
    exports: [SequelizeModule],
    controllers: [AuthController],
    providers: [AuthService, UsersService, CeremoniesService, CircuitsService]
})
export class AuthModule {}
