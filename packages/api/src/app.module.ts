import { Module } from "@nestjs/common"
import { AppController } from "./controllers/app"
import { AppService } from "./services/app"
import { ConfigModule } from "@nestjs/config"
import { JwtModule } from "@nestjs/jwt"

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true
        }),
        JwtModule.register({
            global: true,
            secret: process.env.JWT_SECRET,
            signOptions: { expiresIn: process.env.JWT_EXPIRES_IN }
        })
    ],
    controllers: [AppController],
    providers: [AppService]
})
export class AppModule {}
