import { Test, TestingModule } from "@nestjs/testing"
import { CeremoniesController } from "./ceremonies.controller"
import { CeremoniesService } from "../service/ceremonies.service"
import { JWTGuard } from "../../auth/guard/jwt.guard"
import { CeremonyGuard } from "../../auth/guard/ceremony.guard"
import { CoordinatorGuard } from "../../auth/guard/coordinator.guard"
import { CeremonyDto, CreateCircuitsDto } from "../dto/ceremony-dto"
import { JWTDto } from "../../auth/dto/auth-dto"
import {
    CeremonyState,
    CeremonyTimeoutType,
    CeremonyType,
    CircuitContributionVerificationMechanism
} from "@p0tion/actions"
import { AuthProvider } from "../../types/enums"
import { CircuitDto } from "../../circuits/dto/circuits-dto"

describe("CeremoniesController", () => {
    let controller: CeremoniesController
    let ceremoniesService: CeremoniesService

    const mockCeremoniesService = {
        create: jest.fn(),
        update: jest.fn(),
        createCircuits: jest.fn(),
        findById: jest.fn(),
        findOpened: jest.fn(),
        findClosed: jest.fn(),
        findAll: jest.fn(),
        finalizeCeremony: jest.fn(),
        isCoordinator: jest.fn()
    }

    const getCurrentTimestamp = () => Math.floor(Date.now())

    const mockJwt: JWTDto = {
        exp: Math.floor(Date.now() / 1000) + 3600,
        sub: "user1",
        user: {
            id: "user1",
            displayName: "Test User",
            creationTime: getCurrentTimestamp(),
            lastSignInTime: getCurrentTimestamp(),
            lastUpdated: getCurrentTimestamp(),
            avatarUrl: "https://example.com/avatar.jpg",
            provider: "github"
        }
    }

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [CeremoniesController],
            providers: [
                {
                    provide: CeremoniesService,
                    useValue: mockCeremoniesService
                }
            ]
        })
            .overrideGuard(JWTGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(CeremonyGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(CoordinatorGuard)
            .useValue({ canActivate: () => true })
            .compile()

        controller = module.get<CeremoniesController>(CeremoniesController)
        ceremoniesService = module.get<CeremoniesService>(CeremoniesService)
    })

    it("should be defined", () => {
        expect(controller).toBeDefined()
    })

    describe("create", () => {
        it("should create a new ceremony", async () => {
            const ceremonyDto: CeremonyDto = {
                prefix: "test_ceremony",
                state: CeremonyState.SCHEDULED,
                type: CeremonyType.PHASE2,
                title: "Test Ceremony",
                description: "This is a test ceremony",
                startDate: getCurrentTimestamp(),
                endDate: getCurrentTimestamp() + 86400000, // 1 day later
                timeoutMechanismType: CeremonyTimeoutType.DYNAMIC,
                penalty: 100,
                authProviders: [AuthProvider.GITHUB],
                github: {
                    minimumFollowing: 5,
                    minimumFollowers: 10,
                    minimumPublicRepos: 3,
                    minimumAge: 30
                },
                siwe: undefined,
                bandada: undefined,
                coordinatorId: "" // This will be set by the controller
            }
            const expectedResult = { id: 1, ...ceremonyDto, coordinatorId: "user1" }

            mockCeremoniesService.create.mockResolvedValue(expectedResult)

            const result = await controller.create({ jwt: mockJwt }, ceremonyDto)

            expect(result).toEqual(expectedResult)
            expect(mockCeremoniesService.create).toHaveBeenCalledWith({
                ...ceremonyDto,
                coordinatorId: "user1"
            })
        })
    })

    describe("update", () => {
        it("should update a ceremony", async () => {
            const updateData: Partial<CeremonyDto> = {
                title: "Updated Ceremony Title",
                description: "Updated ceremony description"
            }
            const ceremonyId = 1
            const expectedResult = true

            mockCeremoniesService.update.mockResolvedValue(expectedResult)

            const result = await controller.update({ jwt: mockJwt }, ceremonyId, updateData)

            expect(result).toEqual(expectedResult)
            expect(mockCeremoniesService.update).toHaveBeenCalledWith(ceremonyId, "user1", updateData)
        })
    })

    describe("createCircuits", () => {
        it("should create circuits for a ceremony", async () => {
            const createCircuitsDto: CreateCircuitsDto = {
                circuits: [
                    {
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
                        description: "Test circuit description",
                        name: "Test Circuit",
                        sequencePosition: 1,
                        zKeySizeInBytes: 1000000
                    }
                ]
            }
            const ceremonyId = 1
            const expectedResult = [{ id: 1, ...createCircuitsDto.circuits[0] }]

            mockCeremoniesService.createCircuits.mockResolvedValue(expectedResult)

            const result = await controller.createCircuits(ceremonyId, createCircuitsDto)

            expect(result).toEqual(expectedResult)
            expect(mockCeremoniesService.createCircuits).toHaveBeenCalledWith(ceremonyId, createCircuitsDto)
        })
    })

    describe("findById", () => {
        it("should find a ceremony by id", async () => {
            const ceremonyId = 1
            const expectedResult = {
                id: 1,
                prefix: "test_ceremony",
                state: CeremonyState.SCHEDULED,
                type: CeremonyType.PHASE2,
                coordinatorId: "user1",
                title: "Test Ceremony",
                description: "This is a test ceremony",
                startDate: getCurrentTimestamp(),
                endDate: getCurrentTimestamp() + 86400000,
                timeoutMechanismType: CeremonyTimeoutType.DYNAMIC,
                penalty: 100,
                authProviders: [AuthProvider.GITHUB],
                github: {
                    minimumFollowing: 5,
                    minimumFollowers: 10,
                    minimumPublicRepos: 3,
                    minimumAge: 30
                },
                circuits: [],
                participants: []
            }

            mockCeremoniesService.findById.mockResolvedValue(expectedResult)

            const result = await controller.findById(ceremonyId)

            expect(result).toEqual(expectedResult)
            expect(mockCeremoniesService.findById).toHaveBeenCalledWith(ceremonyId)
        })
    })

    describe("findOpened", () => {
        it("should find opened ceremonies", async () => {
            const expectedResult = {
                openedCeremonies: [
                    {
                        id: 1,
                        prefix: "opened_ceremony",
                        state: CeremonyState.OPENED,
                        type: CeremonyType.PHASE2,
                        coordinatorId: "user1",
                        title: "Opened Ceremony",
                        description: "This is an opened ceremony",
                        startDate: getCurrentTimestamp() - 86400000,
                        endDate: getCurrentTimestamp() + 86400000,
                        timeoutMechanismType: CeremonyTimeoutType.DYNAMIC,
                        penalty: 100,
                        authProviders: [AuthProvider.GITHUB]
                    }
                ]
            }

            mockCeremoniesService.findOpened.mockResolvedValue(expectedResult)

            const result = await controller.findOpened()

            expect(result).toEqual(expectedResult)
            expect(mockCeremoniesService.findOpened).toHaveBeenCalled()
        })
    })

    describe("findClosed", () => {
        it("should find closed ceremonies", async () => {
            const expectedResult = {
                closedCeremonies: [
                    {
                        id: 2,
                        prefix: "closed_ceremony",
                        state: CeremonyState.CLOSED,
                        type: CeremonyType.PHASE2,
                        coordinatorId: "user2",
                        title: "Closed Ceremony",
                        description: "This is a closed ceremony",
                        startDate: getCurrentTimestamp() - 172800000,
                        endDate: getCurrentTimestamp() - 86400000,
                        timeoutMechanismType: CeremonyTimeoutType.DYNAMIC,
                        penalty: 100,
                        authProviders: [AuthProvider.GITHUB]
                    }
                ]
            }

            mockCeremoniesService.findClosed.mockResolvedValue(expectedResult)

            const result = await controller.findClosed()

            expect(result).toEqual(expectedResult)
            expect(mockCeremoniesService.findClosed).toHaveBeenCalled()
        })
    })

    describe("findAll", () => {
        it("should find all ceremonies", async () => {
            const expectedResult = {
                allCeremonies: [
                    {
                        id: 1,
                        prefix: "opened_ceremony",
                        state: CeremonyState.OPENED,
                        type: CeremonyType.PHASE2,
                        coordinatorId: "user1",
                        title: "Opened Ceremony",
                        description: "This is an opened ceremony",
                        startDate: getCurrentTimestamp() - 86400000,
                        endDate: getCurrentTimestamp() + 86400000,
                        timeoutMechanismType: CeremonyTimeoutType.DYNAMIC,
                        penalty: 100,
                        authProviders: [AuthProvider.GITHUB]
                    },
                    {
                        id: 2,
                        prefix: "closed_ceremony",
                        state: CeremonyState.CLOSED,
                        type: CeremonyType.PHASE2,
                        coordinatorId: "user2",
                        title: "Closed Ceremony",
                        description: "This is a closed ceremony",
                        startDate: getCurrentTimestamp() - 172800000,
                        endDate: getCurrentTimestamp() - 86400000,
                        timeoutMechanismType: CeremonyTimeoutType.DYNAMIC,
                        penalty: 100,
                        authProviders: [AuthProvider.GITHUB]
                    }
                ]
            }

            mockCeremoniesService.findAll.mockResolvedValue(expectedResult)

            const result = await controller.findAll()

            expect(result).toEqual(expectedResult)
            expect(mockCeremoniesService.findAll).toHaveBeenCalled()
        })
    })

    describe("finalizeCeremony", () => {
        it("should finalize a ceremony", async () => {
            const ceremonyId = 1
            const expectedResult = {
                id: 1,
                state: CeremonyState.FINALIZED,
                title: "Finalized Ceremony"
            }

            mockCeremoniesService.finalizeCeremony.mockResolvedValue(expectedResult)

            const result = await controller.finalizeCeremony(ceremonyId)

            expect(result).toEqual(expectedResult)
            expect(mockCeremoniesService.finalizeCeremony).toHaveBeenCalledWith(ceremonyId)
        })
    })

    describe("isCoordinator", () => {
        it("should check if user is coordinator", async () => {
            const ceremonyId = 1
            const expectedResult = { isCoordinator: true }

            mockCeremoniesService.isCoordinator.mockResolvedValue(expectedResult)

            const result = await controller.isCoordinator({ jwt: mockJwt }, ceremonyId)

            expect(result).toEqual(expectedResult)
            expect(mockCeremoniesService.isCoordinator).toHaveBeenCalledWith("user1", ceremonyId)
        })
    })
})
