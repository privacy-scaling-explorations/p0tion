import { Type } from "class-transformer"
import { ArrayMinSize, IsArray, IsNumber, IsString, Min, ValidateNested } from "class-validator"

export class StartMultiPartUploadDataDto {
    @IsString()
    objectKey: string
}

export class TemporaryStoreCurrentContributionMultiPartUploadId {
    @IsString()
    uploadId: string
}

export class GeneratePreSignedUrlsPartsData {
    @IsString()
    objectKey: string

    @IsString()
    uploadId: string

    @IsNumber()
    @Min(0)
    numberOfParts: number
}

export class ETagWithPartNumber {
    @IsString()
    ETag: string

    @IsNumber()
    PartNumber: number
}

export class TemporaryStoreCurrentContributionUploadedChunkData {
    @ValidateNested()
    @Type(() => ETagWithPartNumber)
    chunk: ETagWithPartNumber
}

export class CompleteMultiPartUploadData {
    @IsString()
    objectKey: string

    @IsString()
    uploadId: string

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => ETagWithPartNumber)
    parts: ETagWithPartNumber[]
}
