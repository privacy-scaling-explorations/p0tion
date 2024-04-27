import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { UsersService } from "src/users/service/users.service"

@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private readonly usersService: UsersService) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest()
        const jwt = request["jwt"]
        if (jwt.id !== process.env.ADMIN_ID) {
            throw new UnauthorizedException()
        }
        console.log(jwt)
        return true
    }
}
