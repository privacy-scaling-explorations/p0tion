import { IsString } from "class-validator"

export class BandadaDto {
    @IsString()
    groupId: string
}
