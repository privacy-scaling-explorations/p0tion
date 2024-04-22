import { Allow, IsNumber, IsString } from "class-validator"

export class JWTDto {
    @IsNumber()
    exp: number

    @IsString()
    sub: string

    @Allow()
    user_metadata: {
        role: string
    }
}
