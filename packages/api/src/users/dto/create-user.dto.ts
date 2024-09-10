import { IsString, IsNumber, IsUrl, IsEnum } from "class-validator"

export class CreateUserDto {
    @IsString()
    id: string

    @IsString()
    displayName: string

    @IsNumber()
    creationTime: number

    @IsNumber()
    lastSignInTime: number

    @IsNumber()
    lastUpdated: number

    @IsUrl()
    avatarUrl: string

    @IsEnum(["github", "siwe", "bandada"])
    provider: "github" | "siwe" | "bandada"
}
