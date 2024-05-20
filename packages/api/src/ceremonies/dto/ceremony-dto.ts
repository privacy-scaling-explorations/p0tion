import { CeremonyState, CeremonyTimeoutType, CeremonyType } from "@p0tion/actions"
import { ArrayMinSize, IsArray, IsEnum, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator"
import { Type } from "class-transformer"
import { AuthProvider } from "src/types/enums"
import { GithubDto } from "./github-dto"
import { SiweDto } from "./siwe-dto"
import { BandadaDto } from "./bandada-dto"
import { CircuitDto } from "src/circuits/dto/circuits-dto"

export class CeremonyDto {
    @IsString()
    prefix: string

    @IsIn([CeremonyState.SCHEDULED])
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
    @IsEnum(AuthProvider, { each: true })
    authProviders: AuthProvider[]

    @IsOptional()
    @ValidateNested()
    @Type(() => GithubDto)
    github: GithubDto

    @IsOptional()
    @ValidateNested()
    @Type(() => SiweDto)
    siwe: SiweDto

    @IsOptional()
    @ValidateNested()
    @Type(() => BandadaDto)
    bandada: BandadaDto

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CircuitDto)
    circuits: CircuitDto[]
}
