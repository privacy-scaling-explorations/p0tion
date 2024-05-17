import { Body, Controller, Get, Request, Post, Query, UseGuards } from "@nestjs/common"
import { StorageService } from "../service/storage.service"
import {
    GeneratePreSignedUrlsPartsData,
    StartMultiPartUploadDataDto,
    TemporaryStoreCurrentContributionMultiPartUploadId,
    TemporaryStoreCurrentContributionUploadedChunkData
} from "../dto/storage-dto"
import { JWTGuard } from "src/auth/guard/jwt.guard"
import { JWTDto } from "src/auth/dto/auth-dto"
import { CoordinatorGuard } from "src/auth/guard/coordinator.guard"
import { CeremonyGuard } from "src/auth/guard/ceremony.guard"

@Controller("storage")
export class StorageController {
    constructor(private readonly storageService: StorageService) {}

    @Get("/create-bucket")
    createBucket(@Query("ceremonyPrefix") ceremonyPrefix: string) {
        return this.storageService.createBucket(ceremonyPrefix)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(CoordinatorGuard)
    @UseGuards(JWTGuard)
    @Post("/start-multipart-upload")
    startMultipartUpload(
        @Query("ceremonyId") ceremonyId: number,
        @Request() { jwt }: { jwt: JWTDto },
        @Body() data: StartMultiPartUploadDataDto
    ) {
        return this.storageService.startMultipartUpload(data, ceremonyId, jwt.user.id)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Post("/temporary-store-current-contribution-multipart-upload-id")
    temporaryStoreCurrentContributionMultipartUploadId(
        @Query("ceremonyId") ceremonyId: number,
        @Request() { jwt }: { jwt: JWTDto },
        @Body() data: TemporaryStoreCurrentContributionMultiPartUploadId
    ) {
        return this.storageService.temporaryStoreCurrentContributionMultiPartUploadId(data, ceremonyId, jwt.user.id)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Post("/generate-pre-signed-urls-parts")
    generatePreSignedUrlsParts(
        @Query("ceremonyId") ceremonyId: number,
        @Request() { jwt }: { jwt: JWTDto },
        @Body() data: GeneratePreSignedUrlsPartsData
    ) {
        return this.storageService.generatePreSignedUrlsParts(data, ceremonyId, jwt.user.id)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Post("temporary-store-current-contribution-uploaded-chunk-data")
    temporaryStoreCurrentContributionUploadedChunkData(
        @Query("ceremonyId") ceremonyId: number,
        @Request() { jwt }: { jwt: JWTDto },
        @Body() data: TemporaryStoreCurrentContributionUploadedChunkData
    ) {
        return this.storageService.temporaryStoreCurrentContributionUploadedChunkData(data, ceremonyId, jwt.user.id)
    }
}
