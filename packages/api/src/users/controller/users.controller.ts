import { Controller, Get, Body, Patch, Param, Delete } from "@nestjs/common"
import { UsersService } from "../service/users.service"
import { UpdateUserDto } from "../dto/update-user.dto"

@Controller("users")
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    /*
    TODO: do we need this route???
    @Post()
    create(@Body() createUserDto: CreateUserDto) {
        return this.usersService.create(createUserDto)
    }*/

    @Get()
    findAll() {
        return this.usersService.findAll()
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
    }
}
