import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"

@Injectable()
export class AdminGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest()
        const jwt = request["jwt"]
        if (jwt.user_metadata.role !== "coordinator") {
            throw new UnauthorizedException()
        }
        return true
    }
}
