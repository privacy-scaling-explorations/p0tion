import { CeremonyState, CeremonyTimeoutType, CeremonyType } from "@p0tion/actions"
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsString, ValidateNested } from "class-validator"
import { CircuitDto } from "./circuit-dto"
import { Type } from "class-transformer"

export class CeremonyDto {
    @IsString()
    prefix: string

    @IsEnum(CeremonyState)
    state: CeremonyState

    @IsEnum(CeremonyType)
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

    @IsEnum(CeremonyTimeoutType)
    timeoutMechanismType: CeremonyTimeoutType

    @IsNumber()
    penalty: number

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CircuitDto)
    circuits: CircuitDto[]
}
