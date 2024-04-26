import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { UsersService } from "src/users/service/users.service"

@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private readonly usersService: UsersService) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest()
        const jwt = request["jwt"]
        console.log(jwt)
        const coordinator = this.usersService.findCoordinator(jwt.id)
        if (!coordinator) {
            throw new UnauthorizedException()
        }
        return true
    }
}
