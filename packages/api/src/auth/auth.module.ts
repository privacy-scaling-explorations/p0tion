import { Module } from "@nestjs/common"
import { AuthController } from "./controller/auth.controller"
import { AuthService } from "./service/auth.service"
import { GithubStrategy } from "./service/github.strategy"
import { SequelizeModule } from "@nestjs/sequelize"
import { UserEntity } from "src/users/entities/user.entity"
import { UsersService } from "src/users/service/users.service"

@Module({
    imports: [SequelizeModule.forFeature([UserEntity])],
    exports: [SequelizeModule],
    controllers: [AuthController],
    providers: [AuthService, UsersService, GithubStrategy]
})
export class AuthModule {}
