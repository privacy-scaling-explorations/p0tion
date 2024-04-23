import { Injectable } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { Profile, Strategy } from "passport-github"
import { JwtService } from "@nestjs/jwt"
import { User } from "src/users/entities/user.entity"
import { UsersService } from "src/users/service/users.service"

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, "github") {
    constructor(
        private readonly jwtService: JwtService,
        private readonly usersService: UsersService
    ) {
        super({
            clientID: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
            callbackURL: process.env.GITHUB_CALLBACK_URL,
            scope: ["public_profile"]
        })
    }

    async validate(_accessToken: string, _refreshToken: string, profile: Profile) {
        // create user if not exists
        const _user: User = {
            identifier: profile.emails[0].value || profile.identifier,
            displayName: profile.identifier,
            creationTime: Date.now(),
            lastSignInTime: Date.now(),
            lastUpdated: Date.now(),
            avatarUrl: profile.photos[0].value
        }
        const user = await this.usersService.findOrCreate(_user as any)
        // create jwt
        const jwt = await this.jwtService.signAsync(user)
        // return user data + jwt
        return { user, jwt }
    }
}
