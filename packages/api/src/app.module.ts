import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { AuthModule } from "./auth/auth.module"
import { SequelizeModule } from "@nestjs/sequelize"
import { UsersModule } from "./users/users.module"
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
        }),
        SequelizeModule.forRoot({
            dialect: "sqlite",
            storage: process.env.DB_STORAGE_PATH,
            autoLoadModels: true,
            synchronize: Boolean(process.env.DB_SYNCHRONIZE)
        }),
        AuthModule,
        UsersModule
    ]
})
export class AppModule {}
