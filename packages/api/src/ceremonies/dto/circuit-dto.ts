import { CircuitContributionVerificationMechanism, DiskTypeForVM } from "@p0tion/actions"
import { Type } from "class-transformer"
import { IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator"

export class CompilerDto {
    @IsString()
    version: string

    @IsString()
    commitHash: string
}

export class TemplateDto {
    @IsString()
    source: string

    @IsString()
    commitHash: string

    @IsString({ each: true })
    paramsConfiguration: string[]
}

class VmDto {
    @IsOptional()
    @IsString()
    vmConfigurationType?: string

    @IsOptional()
    @IsEnum(DiskTypeForVM)
    vmDiskType?: DiskTypeForVM

    @IsOptional()
    @IsNumber()
    vmDiskSize?: number

    @IsOptional()
    @IsString()
    vmInstanceId: string
}

export class VerificationDto {
    @IsEnum(CircuitContributionVerificationMechanism)
    cfOrVm: CircuitContributionVerificationMechanism

    @IsOptional()
    @ValidateNested()
    @Type(() => VmDto)
    vm?: VmDto
}

export class CompilationArtifactsDto {
    @IsString()
    r1csFilename: string

    @IsString()
    wasmFilename: string
}

export class MetadataDto {
    @IsString()
    curve: string

    @IsNumber()
    wires: number

    @IsNumber()
    constraints: number

    @IsNumber()
    privateInputs: number

    @IsNumber()
    publicInputs: number

    @IsNumber()
    labels: number

    @IsNumber()
    outputs: number

    @IsNumber()
    pot: number
}

export class FileDto {
    @IsString()
    potFilename: string

    @IsString()
    r1csFilename: string

    @IsString()
    wasmFilename: string

    @IsString()
    initialZkeyFilename: string

    @IsString()
    potStoragePath: string

    @IsString()
    r1csStoragePath: string

    @IsString()
    wasmStoragePath: string

    @IsString()
    initialZkeyStoragePath: string

    @IsString()
    potBlake2bHash: string

    @IsString()
    r1csBlake2bHash: string

    @IsString()
    wasmBlake2bHash: string

    @IsString()
    initialZkeyBlake2bHash: string
}

export class AvgTimingsDto {
    @IsNumber()
    contributionComputation: number

    @IsNumber()
    fullContribution: number

    @IsNumber()
    verifyCloudFunction: number
}

export class WaitingQueueDto {
    @IsNumber()
    completedContributions: number

    @IsString({ each: true })
    contributors: string[]

    @IsString()
    currentContributor: string

    @IsNumber()
    failedContributions: number
}

export class CircuitDto {
    @ValidateNested()
    @Type(() => CompilerDto)
    compiler: CompilerDto

    @ValidateNested()
    @Type(() => TemplateDto)
    template: TemplateDto

    @ValidateNested()
    @Type(() => VerificationDto)
    verification: VerificationDto

    @IsOptional()
    @ValidateNested()
    @Type(() => CompilationArtifactsDto)
    compilationArtifacts?: CompilationArtifactsDto

    @IsOptional()
    @ValidateNested()
    @Type(() => MetadataDto)
    metadata?: MetadataDto

    @IsOptional()
    @ValidateNested()
    @Type(() => FileDto)
    files?: FileDto

    /* These two are created in runtime
    @IsOptional()
    @ValidateNested()
    @Type(() => AvgTimingsDto)
    avgTimings?: AvgTimingsDto

    @IsOptional()
    @ValidateNested()
    @Type(() => WaitingQueueDto)
    waitingQueue?: WaitingQueueDto
    */

    @IsOptional()
    @IsString()
    name?: string

    @IsString()
    description: string

    @IsOptional()
    @IsNumber()
    dynamicThreshold?: number

    @IsOptional()
    @IsNumber()
    fixedTimeWindow?: number

    @IsOptional()
    @IsNumber()
    sequencePosition?: number

    @IsOptional()
    @IsNumber()
    zKeySizeInBytes?: number
}
