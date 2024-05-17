import { Type } from "class-transformer"
import { ArrayMinSize, IsArray, IsNumber, IsString, Min, ValidateNested } from "class-validator"

export class ObjectKeyDto {
    @IsString()
    objectKey: string
}

export class UploadIdDto {
    @IsString()
    uploadId: string
}

export class GeneratePreSignedUrlsPartsData extends ObjectKeyDto {
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

export class CompleteMultiPartUploadData extends ObjectKeyDto {
    @IsString()
    uploadId: string

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => ETagWithPartNumber)
    parts: ETagWithPartNumber[]
}
