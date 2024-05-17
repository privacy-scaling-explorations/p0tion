import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { bandadaReputation, githubReputation, siweReputation } from "@p0tion/actions"
import { CeremoniesService } from "src/ceremonies/service/ceremonies.service"

@Injectable()
export class CeremonyGuard implements CanActivate {
    constructor(private readonly ceremoniesService: CeremoniesService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest()
        const jwt = request["jwt"]
        const user = jwt.user
        console.log(user)
        // Check if they meet the ceremony requirements
        const ceremony = await this.ceremoniesService.findById(request.query.ceremonyId)
        if (!ceremony) {
            throw new UnauthorizedException("The ceremony does not exist.")
        }
        const authProviders = ceremony.authProviders
        const userProvider = user.provider
        if (!authProviders.includes(userProvider)) {
            throw new UnauthorizedException("The user authentication provider is not allowed.")
        }

        let reputable = false
        switch (userProvider) {
            case "github":
                reputable = (
                    await githubReputation(
                        user.id,
                        ceremony.github.minimumFollowing,
                        ceremony.github.minimumFollowers,
                        ceremony.github.minimumPublicRepos,
                        ceremony.github.minimumAge
                    )
                ).reputable
                break
            case "siwe":
                reputable = (
                    await siweReputation(
                        user.id,
                        ceremony.siwe.minimumNonce,
                        ceremony.siwe.blockHeight,
                        ceremony.siwe.chainName
                    )
                ).reputable
                break
            case "bandada":
                const proof = request.body.proof
                const publicSignals = request.body.publicSignals
                reputable = (await bandadaReputation(user.id, proof, publicSignals, ceremony.bandada.groupId)).reputable
                break
            default:
                reputable = false
        }
        if (!reputable) {
            throw new UnauthorizedException("The user does not have enough reputation to join the ceremony.")
        }
        return reputable
    }
}
