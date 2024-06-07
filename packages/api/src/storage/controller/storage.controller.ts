import { Body, Controller, Get, Request, Post, Query, UseGuards } from "@nestjs/common"
import { StorageService } from "../service/storage.service"
import {
    CompleteMultiPartUploadData,
    GeneratePreSignedUrlsPartsData,
    ObjectKeyDto,
    UploadIdDto,
    TemporaryStoreCurrentContributionUploadedChunkData
} from "../dto/storage-dto"
import { JWTGuard } from "src/auth/guard/jwt.guard"
import { JWTDto } from "src/auth/dto/auth-dto"
import { CoordinatorGuard } from "src/auth/guard/coordinator.guard"
import { CeremonyGuard } from "src/auth/guard/ceremony.guard"

@Controller("storage")
export class StorageController {
    constructor(private readonly storageService: StorageService) {}

    @UseGuards(CoordinatorGuard)
    @UseGuards(JWTGuard)
    @Get("/create-bucket")
    createBucket(@Query("ceremonyId") ceremonyId: number) {
        return this.storageService.createBucket(ceremonyId)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Post("/check-if-object-exists")
    checkIfObjectExists(@Query("ceremonyId") ceremonyId: number, @Body() data: ObjectKeyDto) {
        return this.storageService.checkIfObjectExists(data, ceremonyId)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Post("/generate-get-object-pre-signed-url")
    generateGetObjectPreSignedUrl(@Query("ceremonyId") ceremonyId: number, @Body() data: ObjectKeyDto) {
        return this.storageService.generateGetObjectPreSignedUrl(data, ceremonyId)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(CoordinatorGuard)
    @UseGuards(JWTGuard)
    @Post("/start-multipart-upload")
    startMultipartUpload(
        @Query("ceremonyId") ceremonyId: number,
        @Request() { jwt }: { jwt: JWTDto },
        @Body() data: ObjectKeyDto
    ) {
        return this.storageService.startMultipartUpload(data, ceremonyId, jwt.user.id)
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
    @Post("/complete-multipart-upload")
    completeMultipartUpload(
        @Query("ceremonyId") ceremonyId: number,
        @Request() { jwt }: { jwt: JWTDto },
        @Body() data: CompleteMultiPartUploadData
    ) {
        return this.storageService.completeMultipartUpload(data, ceremonyId, jwt.user.id)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Post("/temporary-store-current-contribution-multipart-upload-id")
    temporaryStoreCurrentContributionMultipartUploadId(
        @Query("ceremonyId") ceremonyId: number,
        @Request() { jwt }: { jwt: JWTDto },
        @Body() data: UploadIdDto
    ) {
        return this.storageService.temporaryStoreCurrentContributionMultiPartUploadId(data, ceremonyId, jwt.user.id)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Post("/temporary-store-current-contribution-uploaded-chunk-data")
    temporaryStoreCurrentContributionUploadedChunkData(
        @Query("ceremonyId") ceremonyId: number,
        @Request() { jwt }: { jwt: JWTDto },
        @Body() data: TemporaryStoreCurrentContributionUploadedChunkData
    ) {
        return this.storageService.temporaryStoreCurrentContributionUploadedChunkData(data, ceremonyId, jwt.user.id)
    }
}
