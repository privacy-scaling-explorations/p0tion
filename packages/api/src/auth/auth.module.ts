import { Module } from "@nestjs/common"
import { AuthController } from "./controller/auth.controller"
import { AuthService } from "./service/auth.service"
import { JwtModule } from "@nestjs/jwt"
import { GithubStrategy } from "./service/github.strategy"

@Module({
    imports: [
        JwtModule.register({
            global: true,
            secret: process.env.JWT_SECRET,
            signOptions: { expiresIn: process.env.JWT_EXPIRES_IN }
        })
    ],
    controllers: [AuthController],
    providers: [AuthService, GithubStrategy]
})
export class AuthModule {}
