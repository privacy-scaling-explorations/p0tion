import { Test, TestingModule } from "@nestjs/testing"
import { CircuitsService } from "./circuits.service"
import { getModelToken } from "@nestjs/sequelize"
import { CircuitEntity } from "../entities/circuit.entity"
import { ContributionEntity } from "../entities/contribution.entity"
import { CeremoniesService } from "../../ceremonies/service/ceremonies.service"
import { ParticipantsService } from "../../participants/service/participants.service"
import { CircuitDto, FinalizeCircuitData } from "../dto/circuits-dto"
import { CeremonyEntity } from "../../ceremonies/entities/ceremony.entity"
import { CircuitContributionVerificationMechanism, CeremonyState, ParticipantStatus } from "@p0tion/actions"
import { VerifyContributionData } from "../dto/contribution-dto"
import { Sequelize } from "sequelize-typescript"
import * as utils from "../../lib/utils"
import { blake512FromPath } from "@p0tion/actions"
import * as fs from "fs"
import { SSMClient } from "@aws-sdk/client-ssm"

jest.mock("@p0tion/actions", () => ({
    ...jest.requireActual("@p0tion/actions"),
    createEC2Instance: jest.fn(),
    startEC2Instance: jest.fn(),
    stopEC2Instance: jest.fn(),
    CeremonyState: jest.requireActual("@p0tion/actions").CeremonyState,
    CircuitContributionVerificationMechanism:
        jest.requireActual("@p0tion/actions").CircuitContributionVerificationMechanism,
    ParticipantStatus: jest.requireActual("@p0tion/actions").ParticipantStatus
}))

jest.mock("../../lib/utils")
jest.mock("snarkjs", () => ({
    zKey: {
        verifyFromInit: jest.fn().mockResolvedValue(true)
    }
}))

jest.mock("fs", () => ({
    ...jest.requireActual("fs"),
    unlinkSync: jest.fn()
}))

jest.spyOn(utils, "getAWSVariables").mockReturnValue({
    snsTopic: "mock-sns-topic",
    region: "mock-region"
})

describe("CircuitsService", () => {
    let service: CircuitsService
    let mockCircuitModel: any
    let mockContributionModel: any
    let mockCeremoniesService: any
    let mockParticipantsService: any
    let mockSequelize: any

    beforeEach(async () => {
        mockCircuitModel = {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            findByPk: jest.fn(),
            update: jest.fn()
        }

        mockContributionModel = {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn()
        }

        mockCeremoniesService = {
            getBucketNameOfCeremony: jest.fn(),
            findById: jest.fn(),
            isCoordinator: jest.fn()
        }

        mockParticipantsService = {
            findParticipantOfCeremony: jest.fn()
        }

        mockSequelize = {
            transaction: jest.fn((fn) => fn({ transaction: {} }))
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CircuitsService,
                { provide: getModelToken(CircuitEntity), useValue: mockCircuitModel },
                { provide: getModelToken(ContributionEntity), useValue: mockContributionModel },
                { provide: CeremoniesService, useValue: mockCeremoniesService },
                { provide: ParticipantsService, useValue: mockParticipantsService },
                { provide: Sequelize, useValue: mockSequelize }
            ]
        }).compile()

        service = module.get<CircuitsService>(CircuitsService)
    })

    it("should be defined", () => {
        expect(service).toBeDefined()
    })

    describe("createCircuits", () => {
        it("should create circuits for a ceremony", async () => {
            const mockCeremony = { id: 1, prefix: "test_ceremony" } as CeremonyEntity
            const mockCircuitDto: CircuitDto = {
                compiler: { version: "1.0", commitHash: "abc123" },
                template: { source: "test", commitHash: "def456", paramsConfiguration: [1, 2, 3] },
                verification: { cfOrVm: CircuitContributionVerificationMechanism.CF },
                artifacts: { r1csStoragePath: "/path/r1cs", wasmStoragePath: "/path/wasm" },
                prefix: "test_circuit",
                description: "Test circuit"
            }

            jest.spyOn(require("@p0tion/actions"), "getBucketName").mockReturnValue("test-bucket")
            mockCircuitModel.create.mockResolvedValue({ ...mockCircuitDto, id: 1 })

            const result = await service.createCircuits([mockCircuitDto], mockCeremony)

            expect(result).toHaveLength(1)
            expect(result[0]).toMatchObject({ ...mockCircuitDto, id: 1 })
            expect(mockCircuitModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...mockCircuitDto,
                    ceremonyId: 1,
                    waitingQueue: expect.any(Object)
                })
            )
        })
    })

    describe("getCircuitsOfCeremony", () => {
        it("should return circuits of a ceremony", async () => {
            const ceremonyId = 1
            const mockCircuits = [
                { id: 1, name: "Circuit 1" },
                { id: 2, name: "Circuit 2" }
            ]
            mockCircuitModel.findAll.mockResolvedValue(mockCircuits)

            const result = await service.getCircuitsOfCeremony(ceremonyId)

            expect(result).toEqual(mockCircuits)
            expect(mockCircuitModel.findAll).toHaveBeenCalledWith({ where: { ceremonyId } })
        })
    })

    describe("finalizeCircuit", () => {
        it("should finalize a circuit", async () => {
            const ceremonyId = 1
            const userId = "user1"
            const data: FinalizeCircuitData = { circuitId: 1, beacon: "test_beacon" }
            const mockBucketName = "test-bucket"
            const mockCircuit = { id: 1, prefix: "test_circuit" }
            const mockContribution = { id: 1, update: jest.fn() }

            mockCeremoniesService.getBucketNameOfCeremony.mockResolvedValue(mockBucketName)
            mockCircuitModel.findByPk.mockResolvedValue(mockCircuit)
            mockContributionModel.findOne.mockResolvedValue(mockContribution)
            jest.spyOn(utils, "downloadArtifactFromS3Bucket").mockResolvedValue(undefined)
            jest.spyOn(require("@p0tion/actions"), "blake512FromPath").mockResolvedValue("mock_hash")

            await service.finalizeCircuit(ceremonyId, userId, data)

            expect(mockContribution.update).toHaveBeenCalled()
        })
    })

    describe("verifyContribution", () => {
        it("should verify a contribution", async () => {
            const ceremonyId = 1
            const userId = "user1"
            const data: VerifyContributionData = { circuitId: 1, contributorOrCoordinatorIdentifier: "contributor1" }
            const mockCeremony = { state: CeremonyState.OPENED }
            const mockParticipant = {
                status: ParticipantStatus.CONTRIBUTING,
                contributions: [{ hash: "mockHash", computationTime: 1000 }],
                verificationStartedAt: Date.now(),
                contributionStartedAt: Date.now() - 1000
            }
            const mockCircuit = {
                id: 1,
                prefix: "test_circuit",
                waitingQueue: { completedContributions: 0, failedContributions: 0 },
                avgTimings: { contributionComputation: 0, fullContribution: 0, verifyCloudFunction: 0 },
                verification: { cfOrVm: CircuitContributionVerificationMechanism.CF },
                files: {}
            }

            const mockUpdatedCircuit = {
                ...mockCircuit,
                update: jest.fn(),
                waitingQueue: { completedContributions: 0, failedContributions: 0 }
            }

            mockCeremoniesService.findById.mockResolvedValue(mockCeremony)
            mockParticipantsService.findParticipantOfCeremony.mockResolvedValue(mockParticipant)
            mockCircuitModel.findByPk.mockResolvedValueOnce(mockCircuit).mockResolvedValueOnce(mockUpdatedCircuit)
            mockCeremoniesService.isCoordinator.mockResolvedValue({ isCoordinator: false })
            jest.spyOn(utils, "createTemporaryLocalPath").mockReturnValue("/tmp/test")
            jest.spyOn(utils, "downloadArtifactFromS3Bucket").mockResolvedValue(undefined)
            jest.spyOn(require("@p0tion/actions"), "blake512FromPath").mockResolvedValue("mock_hash")
            ;(fs.unlinkSync as jest.Mock).mockImplementation(() => {})

            mockContributionModel.create.mockResolvedValue({
                participantUserId: userId,
                participantCeremonyId: ceremonyId,
                circuitId: data.circuitId,
                contributionComputationTime: 1000,
                verificationComputationTime: 2000,
                zkeyIndex: "1",
                files: {},
                verificationSoftware: {},
                valid: true
            })

            const result = await service.verifyContribution(ceremonyId, userId, data)

            expect(result).toEqual({ result: true })
            expect(mockContributionModel.create).toHaveBeenCalled()
            expect(mockUpdatedCircuit.update).toHaveBeenCalled()
        })
    })

    describe("refreshParticipantAfterContributionVerification", () => {
        it("should refresh participant after contribution verification", async () => {
            const mockContribution = {
                participantUserId: "user1",
                participantCeremonyId: 1,
                id: 1
            }
            const mockCircuits = [{ id: 1 }, { id: 2 }]
            const mockParticipant = {
                userId: "user1",
                status: ParticipantStatus.CONTRIBUTING,
                contributionProgress: 1,
                contributions: [{ id: null }],
                update: jest.fn()
            }

            mockCircuitModel.findAll.mockResolvedValue(mockCircuits)
            mockParticipantsService.findParticipantOfCeremony.mockResolvedValue(mockParticipant)

            await service.refreshParticipantAfterContributionVerification(mockContribution as ContributionEntity)

            expect(mockParticipant.update).toHaveBeenCalledTimes(2)
            expect(mockSequelize.transaction).toHaveBeenCalled()
        })
    })

    describe("getCircuitContributionsFromParticipant", () => {
        it("should return contributions for a specific circuit and participant", async () => {
            const ceremonyId = 1
            const circuitId = 1
            const userId = "user1"
            const mockContributions = [{ id: 1 }, { id: 2 }]
            mockContributionModel.findAll.mockResolvedValue(mockContributions)

            const result = await service.getCircuitContributionsFromParticipant(ceremonyId, circuitId, userId)

            expect(result).toEqual({ contributions: mockContributions })
            expect(mockContributionModel.findAll).toHaveBeenCalledWith({
                where: { participantUserId: userId, participantCeremonyId: ceremonyId, circuitId: circuitId }
            })
        })
    })

    describe("getCircuitById", () => {
        it("should return a specific circuit", async () => {
            const ceremonyId = 1
            const circuitId = 1
            const mockCircuit = { id: 1, name: "Circuit 1" }
            mockCircuitModel.findOne.mockResolvedValue(mockCircuit)

            const result = await service.getCircuitById(ceremonyId, circuitId)

            expect(result).toEqual({ circuit: mockCircuit })
            expect(mockCircuitModel.findOne).toHaveBeenCalledWith({ where: { ceremonyId, id: circuitId } })
        })
    })

    describe("setupAWSEnvironment", () => {
        it("should setup AWS environment for VM verification", async () => {
            const mockCircuit: CircuitDto = {
                name: "test_circuit",
                verification: {
                    cfOrVm: CircuitContributionVerificationMechanism.VM,
                    vm: { vmConfigurationType: "t2.micro" }
                },
                files: { initialZkeyStoragePath: "/path/zkey", potStoragePath: "/path/pot" },
                zKeySizeInBytes: 1000000,
                metadata: { pot: 20 }
            } as CircuitDto
            const bucketName = "test-bucket"
            const mockEC2Instance = { InstanceId: "i-1234567890abcdef0" }

            jest.spyOn(utils, "createEC2Client").mockResolvedValue({} as any)
            jest.spyOn(require("@p0tion/actions"), "createEC2Instance").mockResolvedValue(mockEC2Instance)
            jest.spyOn(utils, "uploadFileToBucketNoFile").mockResolvedValue(undefined)

            const result = await service.setupAWSEnvironment(mockCircuit, bucketName)

            expect(result).toHaveProperty("instance")
            expect(result).toHaveProperty("vmDiskSize")
            expect(require("@p0tion/actions").createEC2Instance).toHaveBeenCalled()
            expect(utils.uploadFileToBucketNoFile).toHaveBeenCalled()
        })
    })

    describe("waitForVMCommandExecution", () => {
        it("should wait for VM command execution to complete", async () => {
            const mockSSM = {} as SSMClient
            const vmInstanceId = "i-1234567890abcdef0"
            const commandId = "command-1234567890"

            jest.spyOn(require("@p0tion/actions"), "retrieveCommandStatus").mockResolvedValue("Success")

            // Mock the setTimeout function to resolve immediately
            jest.useFakeTimers()

            const waitPromise = service.waitForVMCommandExecution(mockSSM, vmInstanceId, commandId)

            // Fast-forward all timers
            jest.runAllTimers()

            await expect(waitPromise).resolves.not.toThrow()

            // Restore timers to their normal behavior
            jest.useRealTimers()
        }, 10000) // Increase timeout to 10 seconds
    })
})
