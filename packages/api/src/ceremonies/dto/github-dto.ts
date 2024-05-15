import { IsNumber } from "class-validator"

export class GithubDto {
    @IsNumber()
    minimumFollowing: number

    @IsNumber()
    minimumFollowers: number

    @IsNumber()
    minimumPublicRepos: number

    @IsNumber()
    minimumAge: number
}
