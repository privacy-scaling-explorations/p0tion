import { CeremonyState, CeremonyTimeoutType, CeremonyType } from "@p0tion/actions"
import { ArrayMinSize, IsArray, IsNumber, IsString, ValidateNested } from "class-validator"
import { CircuitDto } from "./circuit-dto"
import { Type } from "class-transformer"

export class CeremonyDto {
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

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CircuitDto)
    circuits: CircuitDto[]
}
