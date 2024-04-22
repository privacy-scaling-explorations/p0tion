import { Injectable } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { Profile, Strategy } from "passport-github"

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, "github") {
    constructor() {
        super({
            clientID: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
            callbackURL: process.env.GITHUB_CALLBACK_URL,
            scope: ["public_profile"]
        })
    }

    async validate(accessToken: string, _refreshToken: string, profile: Profile) {
        return profile
    }
}
