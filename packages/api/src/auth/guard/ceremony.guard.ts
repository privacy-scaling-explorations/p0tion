import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { githubReputation } from "@p0tion/actions"
import { CeremoniesService } from "src/ceremonies/service/ceremonies.service"

@Injectable()
export class CeremonyGuard implements CanActivate {
    constructor(private readonly ceremoniesService: CeremoniesService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest()
        const jwt = request["jwt"]
        const user = jwt.user
        // Check if they meet the ceremony requirements
        const ceremony = await this.ceremoniesService.findById(request.query.ceremonyId)
        console.log(jwt)
        console.log(ceremony)
        const authProviders = ceremony.authProviders
        const userProvider = user.provider
        if (!authProviders.includes(userProvider)) {
            throw new UnauthorizedException()
        }

        switch (userProvider) {
            case "github":
                const { reputable } = await githubReputation(
                    user.id,
                    ceremony.github.minimumFollowing,
                    ceremony.github.minimumFollowers,
                    ceremony.github.minimumPublicRepos,
                    ceremony.github.minimumAge
                )
                if (!reputable) {
                    throw new UnauthorizedException()
                }
                break
            case "siwe":
                console.log("hey siwe")
                break
            case "bandada":
                console.log("hey bandada")
                break
            default:
                throw new UnauthorizedException()
        }
        return true
    }
}
