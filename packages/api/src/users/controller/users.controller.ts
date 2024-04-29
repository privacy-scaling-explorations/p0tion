import { Controller, Get, Request, Query, UseGuards } from "@nestjs/common"
import { UsersService } from "../service/users.service"
import { JWTDto } from "src/auth/dto/auth-dto"
import { JWTGuard } from "src/auth/guard/jwt.guard"

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

    @Get("/find-coordinators-by-ceremony")
    findCoordinators(
        @Query("ids")
        ids: string[]
    ) {
        return this.usersService.findCoordinatorsByCeremony(ids)
    }

    @UseGuards(JWTGuard)
    @Get("/is-coordinator")
    isCoordinator(@Request() { jwt }: { jwt: JWTDto }) {
        return this.usersService.findCoordinator(jwt.user.id)
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
