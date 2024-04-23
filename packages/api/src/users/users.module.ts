import { Module } from "@nestjs/common"
import { UsersService } from "./service/users.service"
import { UsersController } from "./controller/users.controller"
import { SequelizeModule } from "@nestjs/sequelize"
import { UserEntity } from "./entities/user.entity"

@Module({
    controllers: [UsersController],
    providers: [UsersService],
    imports: [SequelizeModule.forFeature([UserEntity])],
    exports: [SequelizeModule]
})
export class UsersModule {}
