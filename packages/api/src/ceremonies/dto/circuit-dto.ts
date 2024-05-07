import { CircuitContributionVerificationMechanism, DiskTypeForVM } from "@p0tion/actions"
import { Type } from "class-transformer"
import { IsNumber, IsOptional, IsString, ValidateNested } from "class-validator"

class CompilerDto {
    @IsString()
    version: string

    @IsString()
    commitHash: string
}

class TemplateDto {
    @IsString()
    source: string

    @IsString()
    commitHash: string

    @IsString({ each: true })
    paramsConfiguration: string[]
}

class VerificationDto {
    @IsString()
    cfOrVm: CircuitContributionVerificationMechanism

    @IsOptional()
    @ValidateNested()
    @Type(() => VmDto)
    vm?: VmDto
}

class VmDto {
    @IsOptional()
    @IsString()
    vmConfigurationType?: string

    @IsOptional()
    @IsString()
    vmDiskType?: DiskTypeForVM

    @IsOptional()
    @IsNumber()
    vmDiskSize?: number

    @IsOptional()
    @IsString()
    vmInstanceId: string
}

class CompilationArtifactsDto {
    @IsString()
    r1csFilename: string

    @IsString()
    wasmFilename: string
}

class MetadataDto {
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

class FileDto {
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
}
