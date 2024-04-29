import { Module } from "@nestjs/common"
import { AuthController } from "./controller/auth.controller"
import { AuthService } from "./service/auth.service"
import { SequelizeModule } from "@nestjs/sequelize"
import { UserEntity } from "src/users/entities/user.entity"
import { UsersService } from "src/users/service/users.service"
import { CoordinatorEntity } from "src/users/entities/coordinator.entity"

@Module({
    imports: [SequelizeModule.forFeature([UserEntity, CoordinatorEntity])],
    exports: [SequelizeModule],
    controllers: [AuthController],
    providers: [AuthService, UsersService]
})
export class AuthModule {}
