import { Body, Controller, Get, Request, Post, Query, UseGuards } from "@nestjs/common"
import { StorageService } from "../service/storage.service"
import { StartMultiPartUploadDataDto } from "../dto/storage-dto"
import { JWTGuard } from "src/auth/guard/jwt.guard"
import { JWTDto } from "src/auth/dto/auth-dto"

@Controller("storage")
export class StorageController {
    constructor(private readonly storageService: StorageService) {}

    @Get("/create-bucket")
    createBucket(@Query("ceremonyPrefix") ceremonyPrefix: string) {
        return this.storageService.createBucket(ceremonyPrefix)
    }

    @UseGuards(JWTGuard)
    @Post("/start-multipart-upload")
    startMultipartUpload(@Request() { jwt }: { jwt: JWTDto }, @Body() data: StartMultiPartUploadDataDto) {
        return this.storageService.startMultipartUpload(data, jwt.user.id)
    }
}
