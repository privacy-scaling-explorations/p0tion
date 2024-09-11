import { Test, TestingModule } from "@nestjs/testing"
import { CeremoniesService } from "./ceremonies.service"
import { getModelToken } from "@nestjs/sequelize"
import { CeremonyEntity } from "../entities/ceremony.entity"
import { CircuitsService } from "../../circuits/service/circuits.service"
import { CeremonyDto, CreateCircuitsDto } from "../dto/ceremony-dto"
import {
    CeremonyState,
    CeremonyTimeoutType,
    CeremonyType,
    CircuitContributionVerificationMechanism,
    terminateEC2Instance
} from "@p0tion/actions"
import { CircuitEntity } from "../../circuits/entities/circuit.entity"
import { ParticipantEntity } from "../../participants/entities/participant.entity"
import { AuthProvider } from "../../types/enums"
import { CircuitDto } from "../../circuits/dto/circuits-dto"
import { ContributionEntity } from "../../circuits/entities/contribution.entity"
import { ScheduleModule } from "@nestjs/schedule"
import * as awsUtils from "../../lib/utils"

jest.mock("@aws-sdk/client-ec2")
jest.mock("../../lib/utils")
// Mock the entire @p0tion/actions module
jest.mock("@p0tion/actions", () => ({
    ...jest.requireActual("@p0tion/actions"),
    terminateEC2Instance: jest.fn(),
    CeremonyState: jest.requireActual("@p0tion/actions").CeremonyState,
    CircuitContributionVerificationMechanism:
        jest.requireActual("@p0tion/actions").CircuitContributionVerificationMechanism
}))

describe("CeremoniesService", () => {
    let service: CeremoniesService
    let mockCeremonyModel: any
    let mockCircuitsService: any

    beforeEach(async () => {
        mockCeremonyModel = {
            create: jest.fn(),
            findAll: jest.fn(),
            findByPk: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn()
        }

        mockCircuitsService = {
            createCircuits: jest.fn(),
            getFinalContributionFromCircuit: jest.fn()
        }

        const module: TestingModule = await Test.createTestingModule({
            imports: [ScheduleModule.forRoot()],
            providers: [
                CeremoniesService,
                {
                    provide: getModelToken(CeremonyEntity),
                    useValue: mockCeremonyModel
                },
                {
                    provide: CircuitsService,
                    useValue: mockCircuitsService
                },
                {
                    provide: getModelToken(CircuitEntity),
                    useValue: {}
                },
                {
                    provide: getModelToken(ContributionEntity),
                    useValue: {}
                }
            ]
        }).compile()

        service = module.get<CeremoniesService>(CeremoniesService)
    })

    it("should be defined", () => {
        expect(service).toBeDefined()
    })

    // Unit Tests
    describe("Unit Tests", () => {
        describe("create", () => {
            it("should create a new ceremony", async () => {
                const ceremonyDto: CeremonyDto = {
                    prefix: "test",
                    state: CeremonyState.SCHEDULED,
                    type: CeremonyType.PHASE2,
                    coordinatorId: "coordinator1",
                    title: "Test Ceremony",
                    description: "A test ceremony",
                    startDate: Date.now(),
                    endDate: Date.now() + 86400000,
                    timeoutMechanismType: CeremonyTimeoutType.DYNAMIC,
                    penalty: 100,
                    authProviders: [AuthProvider.GITHUB],
                    github: {
                        minimumFollowing: 5,
                        minimumFollowers: 10,
                        minimumPublicRepos: 3,
                        minimumAge: 30
                    },
                    siwe: {
                        minimumNonce: 5,
                        blockHeight: 1000000,
                        chainName: "ethereum"
                    },
                    bandada: {
                        groupId: "test-group-id"
                    }
                }

                mockCeremonyModel.create.mockResolvedValue({ id: 1, ...ceremonyDto })

                const result = await service.create(ceremonyDto)

                expect(mockCeremonyModel.create).toHaveBeenCalledWith(ceremonyDto)
                expect(result).toEqual({ id: 1, ...ceremonyDto })
            })
        })

        describe("update", () => {
            it("should update a ceremony", async () => {
                const updateData = { title: "Updated Ceremony" }
                mockCeremonyModel.update.mockResolvedValue([1])

                const result = await service.update(1, "coordinator1", updateData)

                expect(mockCeremonyModel.update).toHaveBeenCalledWith(
                    { id: 1, ...updateData },
                    { where: { id: 1, coordinatorId: "coordinator1" } }
                )
                expect(result).toBe(true)
            })
        })

        describe("createCircuits", () => {
            it("should create circuits for a ceremony", async () => {
                const circuitDto: CircuitDto = {
                    compiler: {
                        version: "1.0.0",
                        commitHash: "abc123"
                    },
                    template: {
                        source: "template source",
                        commitHash: "def456",
                        paramsConfiguration: [1, 2, 3]
                    },
                    verification: {
                        cfOrVm: CircuitContributionVerificationMechanism.CF
                    },
                    artifacts: {
                        r1csStoragePath: "/path/to/r1cs",
                        wasmStoragePath: "/path/to/wasm"
                    },
                    prefix: "test_circuit",
                    description: "A test circuit",
                    name: "Test Circuit",
                    sequencePosition: 1,
                    zKeySizeInBytes: 1000000
                }

                const createCircuitsDto: CreateCircuitsDto = {
                    circuits: [circuitDto]
                }
                const mockCeremony = { id: 1, $set: jest.fn() }
                const mockCircuits = [{ id: 1, ...circuitDto }]

                mockCeremonyModel.findByPk.mockResolvedValue(mockCeremony)
                mockCircuitsService.createCircuits.mockResolvedValue(mockCircuits)

                const result = await service.createCircuits(1, createCircuitsDto)

                expect(mockCeremonyModel.findByPk).toHaveBeenCalledWith(1, expect.any(Object))
                expect(mockCircuitsService.createCircuits).toHaveBeenCalledWith(
                    createCircuitsDto.circuits,
                    mockCeremony
                )
                expect(mockCeremony.$set).toHaveBeenCalledWith("circuits", mockCircuits)
                expect(result).toEqual(mockCircuits)
            })
        })

        describe("findAll", () => {
            it("should return all ceremonies", async () => {
                const mockCeremonies = [
                    { id: 1, title: "Ceremony 1" },
                    { id: 2, title: "Ceremony 2" }
                ]
                mockCeremonyModel.findAll.mockResolvedValue(mockCeremonies)

                const result = await service.findAll()

                expect(mockCeremonyModel.findAll).toHaveBeenCalledWith({
                    include: [CircuitEntity, ParticipantEntity]
                })
                expect(result).toEqual({ allCeremonies: mockCeremonies })
            })
        })

        describe("findById", () => {
            it("should find a ceremony by id", async () => {
                const mockCeremony = { id: 1, title: "Test Ceremony" }
                mockCeremonyModel.findByPk.mockResolvedValue(mockCeremony)

                const result = await service.findById(1)

                expect(mockCeremonyModel.findByPk).toHaveBeenCalledWith(1, {
                    include: [CircuitEntity, ParticipantEntity]
                })
                expect(result).toEqual(mockCeremony)
            })
        })

        describe("findOpened", () => {
            it("should find opened ceremonies", async () => {
                const mockOpenedCeremonies = [
                    { id: 1, state: CeremonyState.OPENED },
                    { id: 2, state: CeremonyState.OPENED }
                ]
                mockCeremonyModel.findAll.mockResolvedValue(mockOpenedCeremonies)

                const result = await service.findOpened()

                expect(mockCeremonyModel.findAll).toHaveBeenCalledWith({
                    where: { state: CeremonyState.OPENED }
                })
                expect(result).toEqual({ openedCeremonies: mockOpenedCeremonies })
            })
        })

        describe("findClosed", () => {
            it("should find closed ceremonies", async () => {
                const mockClosedCeremonies = [
                    { id: 1, state: CeremonyState.CLOSED },
                    { id: 2, state: CeremonyState.CLOSED }
                ]
                mockCeremonyModel.findAll.mockResolvedValue(mockClosedCeremonies)

                const result = await service.findClosed()

                expect(mockCeremonyModel.findAll).toHaveBeenCalledWith({
                    where: { state: CeremonyState.CLOSED }
                })
                expect(result).toEqual({ closedCeremonies: mockClosedCeremonies })
            })
        })

        describe("findCoordinatorOfCeremony", () => {
            it("should find coordinator of a ceremony", async () => {
                const mockCoordinator = { id: 1, userId: "coordinator1" }
                mockCeremonyModel.findOne.mockResolvedValue(mockCoordinator)

                const result = await service.findCoordinatorOfCeremony("coordinator1", 1)

                expect(mockCeremonyModel.findOne).toHaveBeenCalledWith({
                    where: { id: 1, coordinatorId: "coordinator1" }
                })
                expect(result).toEqual(mockCoordinator)
            })
        })

        describe("isCoordinator", () => {
            it("should check if user is coordinator of a ceremony", async () => {
                const mockCoordinator = { id: 1, userId: "coordinator1" }
                mockCeremonyModel.findOne.mockResolvedValue(mockCoordinator)

                const result = await service.isCoordinator("coordinator1", 1)

                expect(mockCeremonyModel.findOne).toHaveBeenCalledWith({
                    where: { id: 1, coordinatorId: "coordinator1" }
                })
                expect(result).toEqual({ isCoordinator: true })
            })

            it("should return false if user is not coordinator", async () => {
                mockCeremonyModel.findOne.mockResolvedValue(null)

                const result = await service.isCoordinator("user1", 1)

                expect(result).toEqual({ isCoordinator: false })
            })
        })

        describe("getBucketNameOfCeremony", () => {
            it("should get bucket name of a ceremony", async () => {
                const mockCeremony = { id: 1, prefix: "test-ceremony" }
                mockCeremonyModel.findByPk.mockResolvedValue(mockCeremony)
                process.env.AWS_CEREMONY_BUCKET_POSTFIX = "-bucket"

                const result = await service.getBucketNameOfCeremony(1)

                expect(mockCeremonyModel.findByPk).toHaveBeenCalledWith(1)
                expect(result).toBe("test-ceremony-bucket")
            })
        })
    })

    // Integration Tests
    describe("Integration Tests", () => {
        describe("finalizeCeremony", () => {
            it("should finalize a ceremony", async () => {
                // Mock the ceremony
                const mockCeremony = {
                    id: 1,
                    state: CeremonyState.CLOSED,
                    circuits: [
                        {
                            id: 1,
                            verification: {
                                cfOrVm: CircuitContributionVerificationMechanism.VM,
                                vm: { vmInstanceId: "i-1234567890abcdef0" }
                            }
                        },
                        { id: 2, verification: { cfOrVm: CircuitContributionVerificationMechanism.CF } }
                    ],
                    update: jest.fn()
                }
                mockCeremonyModel.findByPk.mockResolvedValue(mockCeremony)

                // Mock the getFinalContributionFromCircuit
                mockCircuitsService.getFinalContributionFromCircuit.mockResolvedValue({ id: 1 })

                // Mock the terminateEC2Instance function
                const mockTerminateEC2Instance = jest.fn().mockResolvedValue(undefined)
                jest.spyOn(require("@p0tion/actions"), "terminateEC2Instance").mockImplementation(
                    mockTerminateEC2Instance
                )

                // Mock the createEC2Client function
                const mockEC2Client = {
                    send: jest.fn().mockResolvedValue({
                        $metadata: { httpStatusCode: 200 },
                        TerminatingInstances: [{ InstanceId: "i-1234567890abcdef0" }]
                    })
                }
                jest.spyOn(awsUtils, "createEC2Client").mockResolvedValue(mockEC2Client as any)

                // Call the function
                await service.finalizeCeremony(1)

                // Assertions
                expect(mockCeremonyModel.findByPk).toHaveBeenCalledWith(1, expect.any(Object))
                expect(mockCircuitsService.getFinalContributionFromCircuit).toHaveBeenCalledTimes(2)
                expect(mockCeremony.update).toHaveBeenCalledWith({ state: CeremonyState.FINALIZED })
                expect(mockTerminateEC2Instance).toHaveBeenCalledWith(expect.any(Object), "i-1234567890abcdef0")
            })
        })

        describe("startCeremony", () => {
            it("should start scheduled ceremonies", async () => {
                const mockCeremonies = [
                    { id: 1, state: CeremonyState.SCHEDULED, update: jest.fn() },
                    { id: 2, state: CeremonyState.SCHEDULED, update: jest.fn() }
                ]

                mockCeremonyModel.findAll.mockResolvedValue(mockCeremonies)

                await service.startCeremony()

                expect(mockCeremonyModel.findAll).toHaveBeenCalledWith({
                    where: expect.any(Object)
                })
                mockCeremonies.forEach((ceremony) => {
                    expect(ceremony.update).toHaveBeenCalledWith({ state: CeremonyState.OPENED })
                })
            })
        })

        describe("stopCeremony", () => {
            it("should stop opened ceremonies that have reached their end date", async () => {
                const mockCeremonies = [
                    { id: 1, state: CeremonyState.OPENED, update: jest.fn() },
                    { id: 2, state: CeremonyState.OPENED, update: jest.fn() }
                ]

                mockCeremonyModel.findAll.mockResolvedValue(mockCeremonies)

                await service.stopCeremony()

                expect(mockCeremonyModel.findAll).toHaveBeenCalledWith({
                    where: expect.any(Object)
                })
                mockCeremonies.forEach((ceremony) => {
                    expect(ceremony.update).toHaveBeenCalledWith({ state: CeremonyState.CLOSED })
                })
            })
        })
    })
})
