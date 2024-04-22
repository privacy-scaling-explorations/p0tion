import { Module } from "@nestjs/common"
import { UsersService } from "./service/users.service"
import { UsersController } from "./controller/users.controller"
import { SequelizeModule } from "@nestjs/sequelize"
import { User } from "./entities/user.entity"

@Module({
    controllers: [UsersController],
    providers: [UsersService],
    imports: [SequelizeModule.forFeature([User])],
    exports: [SequelizeModule]
})
export class UsersModule {}
