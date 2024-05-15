import { IsNumber, IsString } from "class-validator"

export class SiweDto {
    @IsNumber()
    minimumNonce: number

    @IsNumber()
    blockHeight: number

    @IsString()
    chainName: string
}
