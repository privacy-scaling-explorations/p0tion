import { Controller, Get, Query } from "@nestjs/common"
import { UsersService } from "../service/users.service"

@Controller("users")
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get("/find-by-ids")
    findByIds(
        @Query("ids")
        ids: string[]
    ) {
        return this.usersService.findByIds(ids)
    }
}
