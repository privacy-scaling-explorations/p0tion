import { Module } from "@nestjs/common"
import { AuthController } from "./controller/auth.controller"
import { AuthService } from "./service/auth.service"
import { JwtModule } from "@nestjs/jwt"
import { GithubStrategy } from "./service/github.strategy"
import { SequelizeModule } from "@nestjs/sequelize"
import { UserEntity } from "src/users/entities/user.entity"
import { UsersService } from "src/users/service/users.service"

@Module({
    imports: [
        JwtModule.register({
            global: true,
            secret: process.env.JWT_SECRET,
            signOptions: { expiresIn: process.env.JWT_EXPIRES_IN }
        }),
        SequelizeModule.forFeature([UserEntity])
    ],
    exports: [SequelizeModule],
    controllers: [AuthController],
    providers: [AuthService, UsersService, GithubStrategy]
})
export class AuthModule {}
