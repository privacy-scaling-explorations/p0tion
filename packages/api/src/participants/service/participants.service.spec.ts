import { Test, TestingModule } from "@nestjs/testing"
import { ParticipantsService } from "./participants.service"
import { getModelToken } from "@nestjs/sequelize"
import { ParticipantEntity } from "../entities/participant.entity"
import { CeremoniesService } from "../../ceremonies/service/ceremonies.service"
import { CircuitsService } from "../../circuits/service/circuits.service"
import { Sequelize } from "sequelize-typescript"
import { CeremonyState, ParticipantStatus, ParticipantContributionStep } from "@p0tion/actions"
import {
    PermanentlyStoreCurrentContributionTimeAndHash,
    TemporaryStoreCurrentContributionMultiPartUploadId
} from "../dto/participants-dto"
// import { TemporaryStoreCurrentContributionUploadedChunkData } from "../../storage/dto/storage-dto"
// import { CronExpression } from "@nestjs/schedule"

import { LogLevel } from "../../types/enums"
import * as errors from "../../lib/errors"

type MockedFunction<T extends (...args: any[]) => any> = jest.MockedFunction<T> & {
    mock: jest.MockContext<ReturnType<T>, Parameters<T>>
}

jest.mock("../../lib/errors", () => ({
    printLog: jest.fn(),
    logAndThrowError: jest.fn()
}))

describe("ParticipantsService", () => {
    let service: ParticipantsService
    let mockParticipantModel: any
    let mockCeremoniesService: any
    let mockCircuitsService: any
    let mockSequelize: any

    beforeEach(async () => {
        mockParticipantModel = {
            findOne: jest.fn(),
            findAll: jest.fn(),
            create: jest.fn(),
            update: jest.fn()
        }

        mockCeremoniesService = {
            findById: jest.fn(),
            isCoordinator: jest.fn(),
            findAll: jest.fn()
        }

        mockCircuitsService = {
            getCircuitsOfCeremony: jest.fn(),
            getCircuitById: jest.fn()
        }

        mockSequelize = {
            transaction: jest.fn((fn) => fn({ transaction: {} }))
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ParticipantsService,
                { provide: getModelToken(ParticipantEntity), useValue: mockParticipantModel },
                { provide: CeremoniesService, useValue: mockCeremoniesService },
                { provide: CircuitsService, useValue: mockCircuitsService },
                { provide: Sequelize, useValue: mockSequelize }
            ]
        }).compile()

        service = module.get<ParticipantsService>(ParticipantsService)
    })

    it("should be defined", () => {
        expect(service).toBeDefined()
    })

    describe("findParticipantOfCeremony", () => {
        it("should find a participant for a ceremony", async () => {
            const mockParticipant = { userId: "user1", ceremonyId: 1 }
            mockParticipantModel.findOne.mockResolvedValue(mockParticipant)

            const result = await service.findParticipantOfCeremony("user1", 1)

            expect(mockParticipantModel.findOne).toHaveBeenCalledWith({ where: { userId: "user1", ceremonyId: 1 } })
            expect(result).toEqual(mockParticipant)
        })
    })

    describe("checkParticipantForCeremony", () => {
        it("should register a new participant if not exists", async () => {
            mockCeremoniesService.findById.mockResolvedValue({ id: 1, state: CeremonyState.OPENED })
            mockParticipantModel.findOne.mockResolvedValue(null)
            mockParticipantModel.create.mockResolvedValue({ userId: "user1", ceremonyId: 1 })

            const result = await service.checkParticipantForCeremony(1, "user1")

            expect(mockParticipantModel.create).toHaveBeenCalled()
            expect(result).toEqual({ canContribute: true })
        })

        it("should return false if participant has already contributed to all circuits", async () => {
            mockCeremoniesService.findById.mockResolvedValue({ id: 1, state: CeremonyState.OPENED })
            mockParticipantModel.findOne.mockResolvedValue({
                userId: "user1",
                contributionProgress: 2,
                status: ParticipantStatus.DONE
            })
            mockCircuitsService.getCircuitsOfCeremony.mockResolvedValue([{}, {}])

            const result = await service.checkParticipantForCeremony(1, "user1")

            expect(result).toEqual({ canContribute: false })
        })
    })

    describe("progressToNextCircuitForContribution", () => {
        it("should progress participant to next circuit", async () => {
            const mockParticipant = {
                userId: "user1",
                contributionProgress: 1,
                status: ParticipantStatus.CONTRIBUTED,
                contributionStep: ParticipantContributionStep.COMPLETED,
                update: jest.fn()
            }
            mockParticipantModel.findOne.mockResolvedValue(mockParticipant)

            await service.progressToNextCircuitForContribution(1, "user1")

            expect(mockParticipant.update).toHaveBeenCalledWith({
                contributionProgress: 2,
                status: ParticipantStatus.READY
            })
        })
    })

    describe("permanentlyStoreCurrentContributionTimeAndHash", () => {
        it("should store contribution time and hash", async () => {
            const mockParticipant = {
                userId: "user1",
                status: ParticipantStatus.CONTRIBUTING,
                contributionStep: ParticipantContributionStep.COMPUTING,
                contributions: [],
                update: jest.fn()
            }
            mockParticipantModel.findOne.mockResolvedValue(mockParticipant)
            mockCeremoniesService.isCoordinator.mockResolvedValue({ isCoordinator: false })

            const data: PermanentlyStoreCurrentContributionTimeAndHash = {
                contributionHash: "hash123",
                contributionComputationTime: 1000
            }

            await service.permanentlyStoreCurrentContributionTimeAndHash(1, "user1", data)

            expect(mockParticipant.update).toHaveBeenCalledWith({
                contributions: [{ hash: "hash123", computationTime: 1000 }]
            })
        })
    })

    describe("temporaryStoreCurrentContributionMultipartUploadId", () => {
        it("should store multipart upload ID", async () => {
            const mockParticipant = {
                userId: "user1",
                contributionStep: ParticipantContributionStep.UPLOADING,
                tempContributionData: {},
                update: jest.fn()
            }
            mockParticipantModel.findOne.mockResolvedValue(mockParticipant)

            const data: TemporaryStoreCurrentContributionMultiPartUploadId = {
                uploadId: "upload123"
            }

            await service.temporaryStoreCurrentContributionMultipartUploadId(1, "user1", data)

            expect(mockParticipant.update).toHaveBeenCalledWith({
                tempContributionData: { uploadId: "upload123", chunks: [] }
            })
        })
    })

    describe("checkAndPrepareCoordinatorForFinalization", () => {
        it("should prepare coordinator for finalization", async () => {
            const mockCeremony = { id: 1, state: CeremonyState.CLOSED }
            const mockParticipant = {
                userId: "user1",
                status: ParticipantStatus.DONE,
                contributionProgress: 2,
                update: jest.fn()
            }
            mockCeremoniesService.findById.mockResolvedValue(mockCeremony)
            mockParticipantModel.findOne.mockResolvedValue(mockParticipant)
            mockCircuitsService.getCircuitsOfCeremony.mockResolvedValue([{}, {}])

            const result = await service.checkAndPrepareCoordinatorForFinalization(1, "user1")

            expect(mockParticipant.update).toHaveBeenCalledWith({ status: ParticipantStatus.FINALIZING })
            expect(result).toEqual({ value: true })
        })
    })

    describe("coordinate", () => {
        it("should coordinate a single participant", async () => {
            const mockParticipant = {
                userId: "user1",
                status: ParticipantStatus.READY,
                update: jest.fn()
            }
            const mockCircuit = {
                id: 1,
                waitingQueue: { contributors: [], currentContributor: "" },
                update: jest.fn()
            }

            await service.coordinate(mockParticipant as any, mockCircuit as any, true)

            expect(mockParticipant.update).toHaveBeenCalled()
            expect(mockCircuit.update).toHaveBeenCalled()
        })
    })

    // describe("coordinateCeremonyParticipant", () => {
    //     it("should coordinate ceremony participants", async () => {
    //         const mockCeremony = {
    //             id: 1,
    //             participants: [
    //                 { userId: "user1", status: ParticipantStatus.READY, contributionProgress: 0 },
    //                 { userId: "user2", status: ParticipantStatus.CONTRIBUTING, contributionProgress: 1 },
    //                 {
    //                     userId: "user3",
    //                     status: ParticipantStatus.CONTRIBUTED,
    //                     contributionProgress: 2,
    //                     contributionStep: ParticipantContributionStep.COMPLETED
    //                 },
    //                 { userId: "user4", status: ParticipantStatus.DONE, contributionProgress: 3 }
    //             ]
    //         }
    //         const mockCircuits = [
    //             { id: 1, waitingQueue: { contributors: [], currentContributor: "" }, update: jest.fn() },
    //             { id: 2, waitingQueue: { contributors: [], currentContributor: "" }, update: jest.fn() },
    //             { id: 3, waitingQueue: { contributors: [], currentContributor: "" }, update: jest.fn() }
    //         ]

    //         mockCeremoniesService.findAll.mockResolvedValue({ allCeremonies: [mockCeremony] })
    //         mockCircuitsService.getCircuitById
    //             .mockResolvedValueOnce({ circuit: mockCircuits[0] })
    //             .mockResolvedValueOnce({ circuit: mockCircuits[1] })
    //             .mockResolvedValueOnce({ circuit: mockCircuits[2] })

    //         await service.coordinateCeremonyParticipant()

    //         expect(mockCeremoniesService.findAll).toHaveBeenCalled()
    //         expect(mockCircuitsService.getCircuitById).toHaveBeenCalledTimes(3)
    //         expect(mockCircuitsService.getCircuitById).toHaveBeenNthCalledWith(1, mockCeremony.id, 1)
    //         expect(mockCircuitsService.getCircuitById).toHaveBeenNthCalledWith(2, mockCeremony.id, 1)
    //         expect(mockCircuitsService.getCircuitById).toHaveBeenNthCalledWith(3, mockCeremony.id, 2)
    //     })
    // })
    describe("coordinateCeremonyParticipant", () => {
        it("should coordinate ceremony participants", async () => {
            const mockCeremonies = [
                {
                    id: 1,
                    participants: [
                        { userId: "user1", status: ParticipantStatus.READY, contributionProgress: 0 },
                        { userId: "user2", status: ParticipantStatus.CONTRIBUTING, contributionProgress: 1 },
                        {
                            userId: "user3",
                            status: ParticipantStatus.CONTRIBUTED,
                            contributionProgress: 2,
                            contributionStep: ParticipantContributionStep.COMPLETED
                        },
                        { userId: "user4", status: ParticipantStatus.DONE, contributionProgress: 3 }
                    ]
                },
                {
                    id: 2,
                    participants: [{ userId: "user5", status: ParticipantStatus.READY, contributionProgress: 1 }]
                }
            ]
            const mockCircuits = [
                { id: 1, waitingQueue: { contributors: [], currentContributor: "" } },
                { id: 2, waitingQueue: { contributors: [], currentContributor: "" } },
                { id: 3, waitingQueue: { contributors: [], currentContributor: "" } }
            ]

            mockCeremoniesService.findAll.mockResolvedValue({ allCeremonies: mockCeremonies })
            mockCircuitsService.getCircuitById.mockImplementation((ceremonyId, circuitId) =>
                Promise.resolve({ circuit: mockCircuits.find((c) => c.id === circuitId) })
            )

            service.coordinate = jest.fn()

            const mockedPrintLog = errors.printLog as MockedFunction<typeof errors.printLog>

            await service.coordinateCeremonyParticipant()

            expect(mockCeremoniesService.findAll).toHaveBeenCalled()
            expect(mockCircuitsService.getCircuitById).toHaveBeenCalledTimes(4)

            expect(service.coordinate).toHaveBeenCalledTimes(4)
            expect(service.coordinate).toHaveBeenNthCalledWith(
                1,
                mockCeremonies[0].participants[0],
                expect.anything(),
                true
            )
            expect(service.coordinate).toHaveBeenNthCalledWith(
                2,
                mockCeremonies[0].participants[2],
                expect.anything(),
                false,
                1
            )
            expect(service.coordinate).toHaveBeenNthCalledWith(
                3,
                mockCeremonies[0].participants[3],
                expect.anything(),
                false,
                1
            )
            expect(service.coordinate).toHaveBeenNthCalledWith(
                4,
                mockCeremonies[1].participants[0],
                expect.anything(),
                true
            )

            expect(mockedPrintLog).toHaveBeenCalled()
            expect(
                mockedPrintLog.mock.calls.some(
                    (call) => call[0].includes("Coordinate participant") && call[1] === LogLevel.DEBUG
                )
            ).toBeTruthy()
            expect(
                mockedPrintLog.mock.calls.some(
                    (call) =>
                        call[0].includes("Participant is ready for first contribution") && call[1] === LogLevel.DEBUG
                )
            ).toBeTruthy()
            expect(
                mockedPrintLog.mock.calls.some(
                    (call) => call[0].includes("Participant completed a contribution") && call[1] === LogLevel.DEBUG
                )
            ).toBeTruthy()
            expect(
                mockedPrintLog.mock.calls.some(
                    (call) => call[0].includes("Coordinate successfully completed") && call[1] === LogLevel.DEBUG
                )
            ).toBeTruthy()
        })
    })
})
