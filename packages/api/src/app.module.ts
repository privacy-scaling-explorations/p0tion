import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { AuthModule } from "./auth/auth.module"
import { SequelizeModule } from "@nestjs/sequelize"
import { UsersModule } from "./users/users.module"

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
        AuthModule,
        UsersModule
    ]
})
export class AppModule {}
