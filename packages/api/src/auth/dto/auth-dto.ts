import { Allow, IsNumber, IsString } from "class-validator"
import { User } from "../../users/entities/user.entity"

export class JWTDto {
    @IsNumber()
    exp: number

    @IsString()
    sub: string

    @Allow()
    user: User
}

export class DeviceFlowTokenDto {
    @IsString()
    access_token: string

    @IsString()
    token_type: string
}

export class GithubUser {
    login: string
    id: number
    node_id: string
    avatar_url: string
    gravatar_id: string
    url: string
    html_url: string
    followers_url: string
    following_url: string
    gists_url: string
    starred_url: string
    subscriptions_url: string
    organizations_url: string
    repos_url: string
    events_url: string
    received_events_url: string
    type: string
    site_admin: boolean
    name: string
    company: string
    blog: string
    location: string
    email: string
    hireable: boolean
    bio: string
    twitter_username: string
    public_repos: number
    public_gists: number
    followers: number
    following: number
    created_at: string
    updated_at: string
}
