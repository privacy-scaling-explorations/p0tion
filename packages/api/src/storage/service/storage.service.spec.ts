import { Test, TestingModule } from "@nestjs/testing"
import { StorageService } from "./storage.service"
import { CeremoniesService } from "../../ceremonies/service/ceremonies.service"
import { ParticipantsService } from "../../participants/service/participants.service"
import { ParticipantStatus, ParticipantContributionStep } from "@p0tion/actions"
import { SPECIFIC_ERRORS } from "../../lib/errors"
import { S3Client } from "@aws-sdk/client-s3"
import { ParticipantEntity } from "../../participants/entities/participant.entity"
import { CeremonyEntity } from "../../ceremonies/entities/ceremony.entity"
import { COMMON_ERRORS } from "../../lib/errors"
import { CeremonyState, CeremonyType } from "@p0tion/actions"
import { CompleteMultiPartUploadData } from "../dto/storage-dto"

const mockS3Client = {
    send: jest.fn()
}

describe("StorageService", () => {
    let service: StorageService
    let ceremoniesService: jest.Mocked<CeremoniesService>
    let participantsService: jest.Mocked<ParticipantsService>

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StorageService,
                {
                    provide: CeremoniesService,
                    useValue: {
                        findById: jest.fn(),
                        getBucketNameOfCeremony: jest.fn()
                    }
                },
                {
                    provide: ParticipantsService,
                    useValue: {
                        findParticipantOfCeremony: jest.fn()
                    }
                },
                {
                    provide: S3Client,
                    useValue: mockS3Client
                }
            ]
        }).compile()

        service = module.get<StorageService>(StorageService)
        ceremoniesService = module.get(CeremoniesService)
        participantsService = module.get(ParticipantsService)
    })

    describe("checkPreConditionForCurrentContributorToInteractWithMultiPartUpload", () => {
        it("should throw an error if participant is not in CONTRIBUTING status and UPLOADING step", async () => {
            const participant = {
                status: ParticipantStatus.WAITING,
                contributionStep: ParticipantContributionStep.DOWNLOADING
            }

            await expect(
                service.checkPreConditionForCurrentContributorToInteractWithMultiPartUpload(participant as any)
            ).rejects.toThrow(SPECIFIC_ERRORS.SE_STORAGE_CANNOT_INTERACT_WITH_MULTI_PART_UPLOAD.message)
        })

        it("should not throw an error if participant is in CONTRIBUTING status and UPLOADING step", async () => {
            const participant = {
                status: ParticipantStatus.CONTRIBUTING,
                contributionStep: ParticipantContributionStep.UPLOADING
            }

            await expect(
                service.checkPreConditionForCurrentContributorToInteractWithMultiPartUpload(participant as any)
            ).resolves.not.toThrow()
        })
    })

    describe("generateGetObjectPreSignedUrl", () => {
        it("should generate a pre-signed URL for getting an object", async () => {
            const ceremonyId = 1
            const data = { objectKey: "test-object" }

            ceremoniesService.getBucketNameOfCeremony.mockResolvedValue("test-bucket")

            mockS3Client.send.mockResolvedValueOnce({
                url: "https://test-bucket.s3.us-east-1.amazonaws.com/test-object?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA4QZZHWSSU4ZJE4YH%2F20240913%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20240913T051823Z&X-Amz-Expires=9000&X-Amz-Signature=34d46e58fa4520e01c7745c143553644d0486983bbca208963527e42c4ac30b8&X-Amz-SignedHeaders=host&x-id=GetObject"
            })

            const result = await service.generateGetObjectPreSignedUrl(data, ceremonyId)

            expect(result.url).toContain("https://test-bucket.s3.us-east-1.amazonaws.com/test-object")
            expect(result.url).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256")
            expect(result.url).toContain("X-Amz-Credential=")
            expect(result.url).toContain("X-Amz-Date=")
            expect(result.url).toContain("X-Amz-Expires=")
            expect(result.url).toContain("X-Amz-Signature=")
        })
    })

    describe("temporaryStoreCurrentContributionMultiPartUploadId", () => {
        it("should store the upload ID for a valid participant", async () => {
            const ceremonyId = 1
            const userId = "user1"
            const uploadId = "test-upload-id"

            const mockParticipant = {
                userId,
                ceremonyId,
                status: ParticipantStatus.CONTRIBUTING,
                contributionStep: ParticipantContributionStep.UPLOADING,
                contributionProgress: 1,
                tempContributionData: {
                    contributionComputationTime: 0,
                    uploadId: "",
                    chunks: []
                },
                update: jest.fn(),
                contributionStartedAt: Date.now()
            } as Partial<ParticipantEntity>

            participantsService.findParticipantOfCeremony.mockResolvedValue(mockParticipant as ParticipantEntity)

            ceremoniesService.findById.mockResolvedValue({
                id: ceremonyId,
                prefix: "test",
                state: CeremonyState.OPENED,
                type: CeremonyType.PHASE2,
                coordinatorId: "other-user"
            } as CeremonyEntity)

            await service.temporaryStoreCurrentContributionMultiPartUploadId({ uploadId }, ceremonyId, userId)

            expect(mockParticipant.update).toHaveBeenCalledWith({
                tempContributionData: {
                    chunks: [],
                    contributionComputationTime: 0,
                    uploadId: "test-upload-id"
                }
            })
        })

        it("should throw an error for an invalid participant", async () => {
            const ceremonyId = 1
            const userId = "user1"
            const uploadId = "test-upload-id"

            participantsService.findParticipantOfCeremony.mockResolvedValue(null)
            ceremoniesService.findById.mockResolvedValue({
                id: ceremonyId,
                prefix: "test",
                state: CeremonyState.OPENED,
                type: CeremonyType.PHASE2,
                coordinatorId: "other-user"
            } as CeremonyEntity)

            await expect(
                service.temporaryStoreCurrentContributionMultiPartUploadId({ uploadId }, ceremonyId, userId)
            ).rejects.toThrow(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA.message)
        })
    })
})

// describe("createBucket", () => {
//     it("should create a bucket if it does not exist", async () => {
//         const ceremonyId = 1
//         const bucketName = "test-bucket"

//         ceremoniesService.findById.mockResolvedValue({
//             id: 1,
//             state: CeremonyState.OPENED,
//             type: CeremonyType.PHASE2,
//             coordinatorId: "coordinator-id",
//             prefix: "test"
//         } as CeremonyEntity)

//         ceremoniesService.getBucketNameOfCeremony.mockResolvedValue(bucketName)

//         mockS3Client.send.mockImplementation((command) => {
//             if (command.constructor.name === "HeadBucketCommand") {
//                 throw { name: "NotFound" }
//             }
//             if (command.constructor.name === "CreateBucketCommand") {
//                 return { Location: `http://${bucketName}.s3.amazonaws.com/` }
//             }
//             return {}
//         })

//         const result = await service.createBucket(ceremonyId)

//         expect(result).toEqual({ bucketName })
//         expect(mockS3Client.send).toHaveBeenCalledTimes(4) // HeadBucket, CreateBucket, PutPublicAccessBlock, PutBucketCors
//     })

//     it("should throw an error if the bucket already exists", async () => {
//         const ceremonyId = 1

//         ceremoniesService.findById.mockResolvedValue({
//             id: 1,
//             state: CeremonyState.OPENED,
//             type: CeremonyType.PHASE2,
//             coordinatorId: "coordinator-id",
//             prefix: "test"
//         } as CeremonyEntity)

//         ceremoniesService.getBucketNameOfCeremony.mockResolvedValue("test-bucket")

//         mockS3Client.send.mockImplementation((command) => {
//             if (command.constructor.name === "HeadBucketCommand") {
//                 return {}
//             }
//         })

//         await expect(service.createBucket(ceremonyId)).rejects.toThrow(
//             SPECIFIC_ERRORS.SE_STORAGE_INVALID_BUCKET_NAME.message
//         )
//     })
// })

// describe("startMultipartUpload", () => {
//     it("should start a multipart upload for a valid participant", async () => {
//         const ceremonyId = 1
//         const userId = "user1"
//         const objectKey = "test-object"
//         const uploadId = "test-upload-id"

//         ceremoniesService.getBucketNameOfCeremony.mockResolvedValue("test-bucket")
//         ceremoniesService.findById.mockResolvedValue({
//             id: ceremonyId,
//             prefix: "test",
//             state: CeremonyState.OPENED,
//             type: CeremonyType.PHASE2,
//             coordinatorId: "coordinator",
//             circuits: []
//         } as CeremonyEntity)

//         participantsService.findParticipantOfCeremony.mockResolvedValue({
//             userId: userId,
//             ceremonyId: ceremonyId,
//             status: ParticipantStatus.CONTRIBUTING,
//             contributionStep: ParticipantContributionStep.UPLOADING,
//             contributionProgress: 1,
//             contributionStartedAt: Date.now(),
//             tempContributionData: {
//                 contributionComputationTime: 0,
//                 uploadId: "",
//                 chunks: []
//             }
//         } as unknown as ParticipantEntity)

//         mockS3Client.send.mockResolvedValueOnce({ UploadId: uploadId })

//         const result = await service.startMultipartUpload({ objectKey }, ceremonyId, userId)

//         expect(result).toEqual({ uploadId })
//         expect(mockS3Client.send).toHaveBeenCalledWith(
//             expect.objectContaining({
//                 Bucket: "test-bucket",
//                 Key: objectKey
//             })
//         )
//     })
// })

// describe("generatePreSignedUrlsParts", () => {
//     it("should generate pre-signed URLs for all parts", async () => {
//         const ceremonyId = 1
//         const userId = "user1"
//         const data = {
//             objectKey: "test-object",
//             uploadId: "test-upload-id",
//             numberOfParts: 3
//         }

//         ceremoniesService.getBucketNameOfCeremony.mockResolvedValue("test-bucket")
//         ceremoniesService.findById.mockResolvedValue({
//             id: 1,
//             prefix: "test-ceremony",
//             state: CeremonyState.OPENED,
//             type: CeremonyType.PHASE2,
//             coordinatorId: "other-user"
//             // Add other required properties as needed
//         } as CeremonyEntity)

//         participantsService.findParticipantOfCeremony.mockResolvedValue({
//             userId: "mockUserId",
//             ceremonyId: 1,
//             status: ParticipantStatus.CONTRIBUTING,
//             contributionStep: ParticipantContributionStep.UPLOADING,
//             contributionProgress: 1,
//             contributionStartedAt: Date.now(),
//             tempContributionData: {
//                 contributionComputationTime: 0,
//                 uploadId: "",
//                 chunks: []
//             }
//         } as ParticipantEntity)

//         mockS3Client.send.mockImplementation((command) => {
//             if (command.constructor.name === "GetObjectCommand") {
//                 return Promise.resolve({
//                     $metadata: { httpStatusCode: 200 },
//                     Body: `https://test-bucket.s3.amazonaws.com/${command.input.Key}?partNumber=${command.input.PartNumber}`
//                 })
//             }
//         })

//         const result = await service.generatePreSignedUrlsParts(data, ceremonyId, userId)

//         expect(result.parts).toHaveLength(3)
//         expect(result.parts[0]).toContain("partNumber=1")
//         expect(result.parts[1]).toContain("partNumber=2")
//         expect(result.parts[2]).toContain("partNumber=3")
//     })
// })

// describe("temporaryStoreCurrentContributionUploadedChunkData", () => {
//     it("should store chunk data for a valid participant", async () => {
//         const ceremonyId = 1
//         const userId = "user1"
//         const data = {
//             chunk: { ETag: "test-etag", PartNumber: 1 }
//         }

//         const mockParticipant = {
//             userId: "mockUserId",
//             ceremonyId: 1,
//             status: ParticipantStatus.CONTRIBUTING,
//             contributionStep: ParticipantContributionStep.UPLOADING,
//             contributionProgress: 1,
//             contributionStartedAt: Date.now(),
//             tempContributionData: {
//                 chunks: [],
//                 contributionComputationTime: 0,
//                 uploadId: ""
//             },
//             update: jest.fn()
//         } as unknown as ParticipantEntity

//         participantsService.findParticipantOfCeremony.mockResolvedValue(mockParticipant)

//         ceremoniesService.findById.mockResolvedValue({
//             id: 1,
//             prefix: "test-ceremony",
//             state: CeremonyState.OPENED,
//             type: CeremonyType.PHASE2,
//             coordinatorId: "other-user"
//             // Add other required properties as needed
//         } as CeremonyEntity)

//         await service.temporaryStoreCurrentContributionUploadedChunkData(data, ceremonyId, userId)

//         expect(mockParticipant.update).toHaveBeenCalledWith(
//             expect.objectContaining({
//                 tempContributionData: { chunks: [data.chunk] }
//             })
//         )
//     })
// })

// describe("completeMultipartUpload", () => {
//     it("should complete the multipart upload", async () => {
//         const ceremonyId = 1
//         const userId = "user1"
//         const data = {
//             objectKey: "test-object",
//             uploadId: "test-upload-id",
//             parts: [{ ETag: "test-etag", PartNumber: 1 }]
//         }

//         ceremoniesService.getBucketNameOfCeremony.mockResolvedValue("test-bucket")
//         ceremoniesService.findById.mockResolvedValue({
//             id: 1,
//             prefix: "test-ceremony",
//             state: CeremonyState.OPENED,
//             type: CeremonyType.PHASE2,
//             coordinatorId: "other-user"
//         } as CeremonyEntity)

//         participantsService.findParticipantOfCeremony.mockResolvedValue({
//             userId: "mockUserId",
//             ceremonyId: 1,
//             status: ParticipantStatus.CONTRIBUTING,
//             contributionStep: ParticipantContributionStep.UPLOADING,
//             contributionProgress: 1,
//             contributionStartedAt: Date.now(),
//             tempContributionData: {
//                 contributionComputationTime: 0,
//                 uploadId: "",
//                 chunks: []
//             }
//         } as unknown as ParticipantEntity)

//         mockS3Client.send.mockResolvedValueOnce({
//             Location: "https://test-bucket.s3.amazonaws.com/test-object"
//         })

//         const result = await service.completeMultipartUpload(data, ceremonyId, userId)

//         expect(result.location).toBe("https://test-bucket.s3.amazonaws.com/test-object")
//     })
// })
