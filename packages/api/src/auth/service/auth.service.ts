import { Injectable } from "@nestjs/common"
import { DeviceFlowTokenDto, GithubUser } from "../dto/auth-dto"
import { JwtService } from "@nestjs/jwt"
import { UsersService } from "src/users/service/users.service"
import { User } from "src/users/entities/user.entity"

@Injectable()
export class AuthService {
    constructor(
        private readonly jwtService: JwtService,
        private readonly usersService: UsersService
    ) {}

    getGithubClientId() {
        return {
            client_id: process.env.GITHUB_CLIENT_ID
        }
    }

    async getUserInfoFromGithub(deviceFlowTokenDto: DeviceFlowTokenDto) {
        try {
            const result = (await fetch("https://api.github.com/user", {
                headers: {
                    Authorization: `token ${deviceFlowTokenDto.access_token}`
                }
            }).then((res) => res.json())) as GithubUser
            // find or create user
            const _user: User = {
                id: result.login || result.email,
                displayName: result.login || result.email,
                creationTime: Date.now(),
                lastSignInTime: Date.now(),
                lastUpdated: Date.now(),
                avatarUrl: result.avatar_url,
                provider: "github"
            }
            const { user } = await this.usersService.findOrCreate(_user as any)
            // create jwt
            const jwt = await this.jwtService.signAsync({ user: user.dataValues })
            return { user, jwt }
        } catch (error) {
            return error
        }
    }
}
