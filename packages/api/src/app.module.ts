import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { AuthModule } from "./auth/auth.module"
import { SequelizeModule } from "@nestjs/sequelize"

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true
        }),
        SequelizeModule.forRoot({
            dialect: "sqlite",
            storage: process.env.DB_PATH,
            autoLoadModels: true,
            synchronize: Boolean(process.env.DB_SYNCHRONIZE)
        }),
        AuthModule
    ]
})
export class AppModule {}
