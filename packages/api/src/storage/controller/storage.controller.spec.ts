import { Test, TestingModule } from "@nestjs/testing"
import { StorageController } from "./storage.controller"
import { StorageService } from "../service/storage.service"
import { JWTDto } from "../../auth/dto/auth-dto"
import {
    ObjectKeyDto,
    GeneratePreSignedUrlsPartsData,
    CompleteMultiPartUploadData,
    UploadIdDto,
    TemporaryStoreCurrentContributionUploadedChunkData
} from "../dto/storage-dto"
import { JWTGuard } from "../../auth/guard/jwt.guard"
import { CoordinatorGuard } from "../../auth/guard/coordinator.guard"
import { CeremonyGuard } from "../../auth/guard/ceremony.guard"
import { JwtService } from "@nestjs/jwt"

describe("StorageController", () => {
    let controller: StorageController
    let storageService: jest.Mocked<StorageService>

    const mockJwtGuard = { canActivate: jest.fn().mockReturnValue(true) }
    const mockCoordinatorGuard = { canActivate: jest.fn().mockReturnValue(true) }
    const mockCeremonyGuard = { canActivate: jest.fn().mockReturnValue(true) }

    const mockJwtService = {
        sign: jest.fn(),
        verify: jest.fn()
    }

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [StorageController],
            providers: [
                {
                    provide: StorageService,
                    useValue: {
                        createBucket: jest.fn(),
                        checkIfObjectExists: jest.fn(),
                        generateGetObjectPreSignedUrl: jest.fn(),
                        startMultipartUpload: jest.fn(),
                        generatePreSignedUrlsParts: jest.fn(),
                        completeMultipartUpload: jest.fn(),
                        temporaryStoreCurrentContributionMultiPartUploadId: jest.fn(),
                        temporaryStoreCurrentContributionUploadedChunkData: jest.fn()
                    }
                },
                {
                    provide: JwtService,
                    useValue: mockJwtService
                }
            ]
        })
            .overrideGuard(JWTGuard)
            .useValue(mockJwtGuard)
            .overrideGuard(CoordinatorGuard)
            .useValue(mockCoordinatorGuard)
            .overrideGuard(CeremonyGuard)
            .useValue(mockCeremonyGuard)
            .compile()

        controller = module.get<StorageController>(StorageController)
        storageService = module.get(StorageService)
    })

    it("should be defined", () => {
        expect(controller).toBeDefined()
    })

    describe("createBucket", () => {
        it("should call storageService.createBucket with ceremonyId", async () => {
            const ceremonyId = 1
            await controller.createBucket(ceremonyId)
            expect(storageService.createBucket).toHaveBeenCalledWith(ceremonyId)
        })
    })

    describe("checkIfObjectExists", () => {
        it("should call storageService.checkIfObjectExists with data and ceremonyId", async () => {
            const ceremonyId = 1
            const data: ObjectKeyDto = { objectKey: "test-key" }
            await controller.checkIfObjectExists(ceremonyId, data)
            expect(storageService.checkIfObjectExists).toHaveBeenCalledWith(data, ceremonyId)
        })
    })

    describe("generateGetObjectPreSignedUrl", () => {
        it("should call storageService.generateGetObjectPreSignedUrl with data and ceremonyId", async () => {
            const ceremonyId = 1
            const data: ObjectKeyDto = { objectKey: "test-key" }
            await controller.generateGetObjectPreSignedUrl(ceremonyId, data)
            expect(storageService.generateGetObjectPreSignedUrl).toHaveBeenCalledWith(data, ceremonyId)
        })
    })

    describe("startMultipartUpload", () => {
        it("should call storageService.startMultipartUpload with data, ceremonyId, and userId", async () => {
            const ceremonyId = 1
            const jwt: JWTDto = { user: { id: "user-id" } } as JWTDto
            const data: ObjectKeyDto = { objectKey: "test-key" }
            await controller.startMultipartUpload(ceremonyId, { jwt }, data)
            expect(storageService.startMultipartUpload).toHaveBeenCalledWith(data, ceremonyId, "user-id")
        })
    })

    describe("generatePreSignedUrlsParts", () => {
        it("should call storageService.generatePreSignedUrlsParts with data, ceremonyId, and userId", async () => {
            const ceremonyId = 1
            const jwt: JWTDto = { user: { id: "user-id" } } as JWTDto
            const data: GeneratePreSignedUrlsPartsData = {
                objectKey: "test-key",
                uploadId: "test-upload-id",
                numberOfParts: 3
            }
            await controller.generatePreSignedUrlsParts(ceremonyId, { jwt }, data)
            expect(storageService.generatePreSignedUrlsParts).toHaveBeenCalledWith(data, ceremonyId, "user-id")
        })
    })

    describe("completeMultipartUpload", () => {
        it("should call storageService.completeMultipartUpload with data, ceremonyId, and userId", async () => {
            const ceremonyId = 1
            const jwt: JWTDto = { user: { id: "user-id" } } as JWTDto
            const data: CompleteMultiPartUploadData = { objectKey: "test-key", uploadId: "test-upload-id", parts: [] }
            await controller.completeMultipartUpload(ceremonyId, { jwt }, data)
            expect(storageService.completeMultipartUpload).toHaveBeenCalledWith(data, ceremonyId, "user-id")
        })
    })

    describe("temporaryStoreCurrentContributionMultipartUploadId", () => {
        it("should call storageService.temporaryStoreCurrentContributionMultiPartUploadId with data, ceremonyId, and userId", async () => {
            const ceremonyId = 1
            const jwt: JWTDto = { user: { id: "user-id" } } as JWTDto
            const data: UploadIdDto = { uploadId: "test-upload-id" }
            await controller.temporaryStoreCurrentContributionMultipartUploadId(ceremonyId, { jwt }, data)
            expect(storageService.temporaryStoreCurrentContributionMultiPartUploadId).toHaveBeenCalledWith(
                data,
                ceremonyId,
                "user-id"
            )
        })
    })

    describe("temporaryStoreCurrentContributionUploadedChunkData", () => {
        it("should call storageService.temporaryStoreCurrentContributionUploadedChunkData with data, ceremonyId, and userId", async () => {
            const ceremonyId = 1
            const jwt: JWTDto = { user: { id: "user-id" } } as JWTDto
            const data: TemporaryStoreCurrentContributionUploadedChunkData = {
                chunk: { ETag: "test-etag", PartNumber: 1 }
            }
            await controller.temporaryStoreCurrentContributionUploadedChunkData(ceremonyId, { jwt }, data)
            expect(storageService.temporaryStoreCurrentContributionUploadedChunkData).toHaveBeenCalledWith(
                data,
                ceremonyId,
                "user-id"
            )
        })
    })
})
