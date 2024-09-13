import { Test, TestingModule } from "@nestjs/testing"
import { ParticipantsController } from "./participants.controller"
import { ParticipantsService } from "../service/participants.service"
import { JWTDto } from "../../auth/dto/auth-dto"
import {
    ParticipantsDto,
    PermanentlyStoreCurrentContributionTimeAndHash,
    TemporaryStoreCurrentContributionMultiPartUploadId
} from "../dto/participants-dto"
import { TemporaryStoreCurrentContributionUploadedChunkData } from "../../storage/dto/storage-dto"
import { JwtService } from "@nestjs/jwt"
import { JWTGuard } from "../../auth/guard/jwt.guard"
import { CeremonyGuard } from "../../auth/guard/ceremony.guard"

describe("ParticipantsController", () => {
    let controller: ParticipantsController
    let service: ParticipantsService

    const mockUser = {
        id: "user1",
        displayName: "Test User",
        creationTime: Date.now(),
        lastSignInTime: Date.now(),
        lastUpdated: Date.now(),
        avatarUrl: "https://example.com/avatar.jpg",
        provider: "github" as "github" | "siwe" | "bandada"
    }

    const mockJwt: JWTDto = {
        exp: Math.floor(Date.now() / 1000) + 3600,
        sub: mockUser.id,
        user: mockUser
    }

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ParticipantsController],
            providers: [
                {
                    provide: ParticipantsService,
                    useValue: {
                        updateByUserIdAndCeremonyId: jest.fn(),
                        findParticipantOfCeremony: jest.fn(),
                        findAllParticipantsByCeremonyId: jest.fn(),
                        findCurrentParticipantOfCeremony: jest.fn(),
                        findCurrentActiveParticipantTimeout: jest.fn(),
                        resumeContributionAfterTimeoutExpiration: jest.fn(),
                        checkParticipantForCeremony: jest.fn(),
                        progressToNextCircuitForContribution: jest.fn(),
                        progressToNextContributionStep: jest.fn(),
                        permanentlyStoreCurrentContributionTimeAndHash: jest.fn(),
                        temporaryStoreCurrentContributionMultipartUploadId: jest.fn(),
                        temporaryStoreCurrentContributionUploadedChunkData: jest.fn(),
                        checkAndPrepareCoordinatorForFinalization: jest.fn()
                    }
                },
                {
                    provide: JwtService,
                    useValue: {
                        sign: jest.fn(),
                        verify: jest.fn()
                    }
                }
            ]
        })
            .overrideGuard(JWTGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .overrideGuard(CeremonyGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile()

        controller = module.get<ParticipantsController>(ParticipantsController)
        service = module.get<ParticipantsService>(ParticipantsService)
    })

    it("should be defined", () => {
        expect(controller).toBeDefined()
    })

    describe("updateParticipant", () => {
        it("should update a participant", async () => {
            const mockData: Partial<ParticipantsDto> = { status: "READY" }
            await controller.updateParticipant(1, { jwt: mockJwt }, mockData)
            expect(service.updateByUserIdAndCeremonyId).toHaveBeenCalledWith(mockUser.id, 1, mockData)
        })
    })

    describe("getParticipant", () => {
        it("should get a participant", async () => {
            await controller.getParticipant(1, { jwt: mockJwt })
            expect(service.findParticipantOfCeremony).toHaveBeenCalledWith(mockUser.id, 1)
        })
    })

    describe("getParticipantById", () => {
        it("should get a participant by id", async () => {
            await controller.getParticipantById(1, "participantId")
            expect(service.findParticipantOfCeremony).toHaveBeenCalledWith("participantId", 1)
        })
    })

    describe("getAllParticipantsByCeremonyId", () => {
        it("should get all participants by ceremony id", async () => {
            await controller.getAllParticipantsByCeremonyId(1)
            expect(service.findAllParticipantsByCeremonyId).toHaveBeenCalledWith(1)
        })
    })

    describe("getCurrentParticipant", () => {
        it("should get the current participant", async () => {
            await controller.getCurrentParticipant(1)
            expect(service.findCurrentParticipantOfCeremony).toHaveBeenCalledWith(1)
        })
    })

    describe("getCurrentActiveParticipantTimeout", () => {
        it("should get the current active participant timeout", async () => {
            await controller.getCurrentActiveParticipantTimeout(1, "participantId")
            expect(service.findCurrentActiveParticipantTimeout).toHaveBeenCalledWith(1, "participantId")
        })
    })

    describe("resumeContributionAfterTimeoutExpiration", () => {
        it("should resume contribution after timeout expiration", async () => {
            await controller.resumeContributionAfterTimeoutExpiration(1, { jwt: mockJwt })
            expect(service.resumeContributionAfterTimeoutExpiration).toHaveBeenCalledWith(1, mockUser.id)
        })
    })

    describe("checkParticipantForCeremony", () => {
        it("should check participant for ceremony", async () => {
            await controller.checkParticipantForCeremony(1, { jwt: mockJwt })
            expect(service.checkParticipantForCeremony).toHaveBeenCalledWith(1, mockUser.id)
        })
    })

    describe("progressToNextCircuitForContribution", () => {
        it("should progress to next circuit for contribution", async () => {
            await controller.progressToNextCircuitForContribution(1, { jwt: mockJwt })
            expect(service.progressToNextCircuitForContribution).toHaveBeenCalledWith(1, mockUser.id)
        })
    })

    describe("progressToNextContributionStep", () => {
        it("should progress to next contribution step", async () => {
            await controller.progressToNextContributionStep(1, { jwt: mockJwt })
            expect(service.progressToNextContributionStep).toHaveBeenCalledWith(1, mockUser.id)
        })
    })

    describe("permanentlyStoreCurrentContributionTimeAndHash", () => {
        it("should permanently store current contribution time and hash", async () => {
            const mockData: PermanentlyStoreCurrentContributionTimeAndHash = {
                contributionHash: "hash123",
                contributionComputationTime: 1000
            }
            await controller.permanentlyStoreCurrentContributionTimeAndHash(1, { jwt: mockJwt }, mockData)
            expect(service.permanentlyStoreCurrentContributionTimeAndHash).toHaveBeenCalledWith(
                1,
                mockUser.id,
                mockData
            )
        })
    })

    describe("temporaryStoreCurrentContributionMultipartUploadId", () => {
        it("should temporarily store current contribution multipart upload id", async () => {
            const mockData: TemporaryStoreCurrentContributionMultiPartUploadId = { uploadId: "upload123" }
            await controller.temporaryStoreCurrentContributionMultipartUploadId(1, { jwt: mockJwt }, mockData)
            expect(service.temporaryStoreCurrentContributionMultipartUploadId).toHaveBeenCalledWith(
                1,
                mockUser.id,
                mockData
            )
        })
    })

    describe("temporaryStoreCurrentContributionUploadedChunkData", () => {
        it("should temporarily store current contribution uploaded chunk data", async () => {
            const mockData: TemporaryStoreCurrentContributionUploadedChunkData = {
                chunk: { ETag: "etag123", PartNumber: 1 }
            }
            await controller.temporaryStoreCurrentContributionUploadedChunkData(1, { jwt: mockJwt }, mockData)
            expect(service.temporaryStoreCurrentContributionUploadedChunkData).toHaveBeenCalledWith(
                1,
                mockUser.id,
                mockData
            )
        })
    })

    describe("checkAndPrepareCoordinatorForFinalization", () => {
        it("should check and prepare coordinator for finalization", async () => {
            await controller.checkAndPrepareCoordinatorForFinalization(1, { jwt: mockJwt })
            expect(service.checkAndPrepareCoordinatorForFinalization).toHaveBeenCalledWith(1, mockUser.id)
        })
    })
})
