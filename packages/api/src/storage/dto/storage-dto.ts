import { IsNumber, IsString, Min } from "class-validator"

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
