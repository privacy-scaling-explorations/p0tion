import { IsOptional, IsString } from "class-validator"

export class ContributionFiles {
    @IsString()
    transcriptFilename: string

    @IsString()
    lastZkeyFilename: string

    @IsString()
    transcriptStoragePath: string

    @IsString()
    lastZkeyStoragePath: string

    @IsString()
    transcriptBlake2bHash: string

    @IsString()
    lastZkeyBlake2bHash: string

    @IsOptional()
    @IsString()
    verificationKeyBlake2bHash?: string

    @IsOptional()
    @IsString()
    verificationKeyFilename?: string

    @IsOptional()
    @IsString()
    verificationKeyStoragePath?: string

    @IsOptional()
    @IsString()
    verifierContractBlake2bHash?: string

    @IsOptional()
    @IsString()
    verifierContractFilename?: string

    @IsOptional()
    @IsString()
    verifierContractStoragePath?: string
}

export class ContributionVerificationSoftware {
    @IsString()
    name: string

    @IsString()
    version: string

    @IsString()
    commitHash: string
}

export class BeaconInfo {
    @IsString()
    value: string

    @IsString()
    hash: string
}
