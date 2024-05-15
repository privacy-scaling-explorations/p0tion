import { IsString } from "class-validator"

export class StartMultiPartUploadDataDto {
    @IsString()
    ceremonyId: string

    @IsString()
    ceremonyPrefix: string

    @IsString()
    objectKey: string
}
