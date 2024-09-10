import { Controller, Get, Query, Param, Post, Body, Put, Delete } from "@nestjs/common"
import { UsersService } from "../service/users.service"
import { CreateUserDto } from "../dto/create-user.dto"
import { UpdateUserDto } from "../dto/update-user.dto"

@Controller("users")
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Post()
    create(@Body() createUserDto: CreateUserDto) {
        return this.usersService.create(createUserDto)
    }

    @Get()
    findAll() {
        return this.usersService.findAll()
    }

    @Get("/find-by-ids")
    findByIds(
        @Query("ids")
        ids: string[]
    ) {
        return this.usersService.findByIds(ids)
    }

    @Get(":id")
    findOne(@Param("id") id: string) {
        return this.usersService.findOne(id)
    }

    @Put(":id")
    update(@Param("id") id: string, @Body() updateUserDto: UpdateUserDto) {
        return this.usersService.update(id, updateUserDto)
    }

    @Delete(":id")
    remove(@Param("id") id: string) {
        return this.usersService.remove(id)
    }
}
