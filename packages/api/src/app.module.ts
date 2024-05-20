import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { AuthModule } from "./auth/auth.module"
import { SequelizeModule } from "@nestjs/sequelize"
import { UsersModule } from "./users/users.module"
import { JwtModule } from "@nestjs/jwt"
import { CeremoniesModule } from "./ceremonies/ceremonies.module"
import { StorageModule } from "./storage/storage.module"
import { ScheduleModule } from "@nestjs/schedule"
import { CircuitsModule } from "./circuits/circuits.module"

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
        ScheduleModule.forRoot(),
        AuthModule,
        UsersModule,
        CeremoniesModule,
        StorageModule,
        CircuitsModule
    ]
})
export class AppModule {}
