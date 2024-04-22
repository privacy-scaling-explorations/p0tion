import { Module } from "@nestjs/common"
import { UsersService } from "./service/users.service"
import { UsersController } from "./controller/users.controller"

@Module({
    controllers: [UsersController],
    providers: [UsersService]
})
export class UsersModule {}
