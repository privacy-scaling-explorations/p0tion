import { CeremonyState, CeremonyTimeoutType, CeremonyType } from "@p0tion/actions"
import { IsNumber, IsString } from "class-validator"

export class CreateCeremonyDto {
    @IsString()
    prefix: string

    @IsString()
    state: CeremonyState

    @IsString()
    type: CeremonyType

    @IsString()
    coordinatorId: string

    @IsString()
    title: string

    @IsString()
    description: string

    @IsNumber()
    startDate: number

    @IsNumber()
    endDate: number

    @IsString()
    timeoutMechanismType: CeremonyTimeoutType

    @IsNumber()
    penalty: number
}
