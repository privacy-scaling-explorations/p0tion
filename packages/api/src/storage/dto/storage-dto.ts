import { IsString } from "class-validator"

export class StartMultiPartUploadDataDto {
    @IsString()
    objectKey: string
}

export class TemporaryStoreCurrentContributionMultiPartUploadId {
    @IsString()
    uploadId: string
}
