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

    /*
    // TODO: do we need this route???
    @Post()
    create(@Body() createUserDto: CreateUserDto) {
        return this.usersService.create(createUserDto)
    }

    @Get(":id")
    findOne(@Param("id") id: string) {
        return this.usersService.findOne(+id)
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() updateUserDto: UpdateUserDto) {
        return this.usersService.update(+id, updateUserDto)
    }

    @Delete(":id")
    remove(@Param("id") id: string) {
        return this.usersService.remove(+id)
    }*/
}
