import { Module } from "@nestjs/common"
import { StorageController } from "./controller/storage.controller"
import { StorageService } from "./service/storage.service"
import { UsersService } from "src/users/service/users.service"
import { UserEntity } from "src/users/entities/user.entity"
import { SequelizeModule } from "@nestjs/sequelize"
import { CeremoniesService } from "src/ceremonies/service/ceremonies.service"
import { CeremonyEntity } from "src/ceremonies/entities/ceremony.entity"
import { CircuitEntity } from "src/ceremonies/entities/circuit.entity"

@Module({
    controllers: [StorageController],
    imports: [SequelizeModule.forFeature([UserEntity, CeremonyEntity, CircuitEntity])],
    providers: [StorageService, UsersService, CeremoniesService]
})
export class StorageModule {}
