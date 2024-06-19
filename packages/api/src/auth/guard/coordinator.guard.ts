import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { CeremoniesService } from "src/ceremonies/service/ceremonies.service"

@Injectable()
export class CoordinatorGuard implements CanActivate {
    constructor(private readonly ceremoniesService: CeremoniesService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest()
        const jwt = request["jwt"]
        const userId = jwt.user.id
        const ceremonyId = request.query.ceremonyId as number
        const isCoordinator = await this.ceremoniesService.findCoordinatorOfCeremony(userId, ceremonyId)
        if (!isCoordinator) {
            throw new UnauthorizedException("The user is not the coordinator of the ceremony.")
        }
        return true
    }
}
