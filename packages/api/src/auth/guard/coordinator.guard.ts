import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { CeremoniesService } from "src/ceremonies/service/ceremonies.service"

@Injectable()
export class CoordinatorGuard implements CanActivate {
    constructor(private readonly ceremoniesService: CeremoniesService) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest()
        const jwt = request["jwt"]
        const userId = jwt.user.id
        const ceremonyId = request.query.ceremonyId
        console.log(jwt)
        const isCoordinator = this.ceremoniesService.isUserCoordinatorOfCeremony(userId, ceremonyId)
        if (!isCoordinator) {
            throw new UnauthorizedException()
        }
        return true
    }
}
