import { Test, TestingModule } from "@nestjs/testing"
import { CircuitsController } from "./circuits.controller"
import { CircuitsService } from "../service/circuits.service"
import { JWTDto } from "../../auth/dto/auth-dto"
import { FinalizeCircuitData } from "../dto/circuits-dto"
import { VerifyContributionData } from "../dto/contribution-dto"
import { JwtService } from "@nestjs/jwt"
import { JWTGuard } from "../../auth/guard/jwt.guard"
import { CeremonyGuard } from "../../auth/guard/ceremony.guard"
import { CeremoniesService } from "../../ceremonies/service/ceremonies.service"

const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn()
}

const mockCeremoniesService = {
    isCoordinator: jest.fn()
}

describe("CircuitsController", () => {
    let controller: CircuitsController
    let mockCircuitsService: Partial<CircuitsService>

    beforeEach(async () => {
        mockCircuitsService = {
            finalizeCircuit: jest.fn(),
            verifyContribution: jest.fn(),
            getCircuitContributionsFromParticipant: jest.fn(),
            getCircuitsOfCeremony: jest.fn(),
            getCircuitById: jest.fn(),
            getContributionById: jest.fn(),
            getContributionsFromCircuit: jest.fn()
        }

        const module: TestingModule = await Test.createTestingModule({
            controllers: [CircuitsController],
            providers: [
                {
                    provide: CircuitsService,
                    useValue: mockCircuitsService
                },
                {
                    provide: JwtService,
                    useValue: mockJwtService
                },
                {
                    provide: CeremoniesService,
                    useValue: mockCeremoniesService
                },
                {
                    provide: JWTGuard,
                    useValue: { canActivate: jest.fn().mockReturnValue(true) }
                },
                {
                    provide: CeremonyGuard,
                    useValue: { canActivate: jest.fn().mockReturnValue(true) }
                }
            ]
        }).compile()

        controller = module.get<CircuitsController>(CircuitsController)
        jest.spyOn(JWTGuard.prototype, "canActivate").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(CeremonyGuard.prototype, "canActivate").mockImplementation(() => Promise.resolve(true))
    })

    it("should be defined", () => {
        expect(controller).toBeDefined()
    })

    describe("finalizeCircuit", () => {
        it("should call circuitsService.finalizeCircuit with correct parameters", async () => {
            const ceremonyId = 1
            const jwt: JWTDto = { user: { id: "user1" } } as JWTDto
            const data: FinalizeCircuitData = { circuitId: 1, beacon: "test_beacon" }

            await controller.finalizeCircuit(ceremonyId, { jwt }, data)

            expect(mockCircuitsService.finalizeCircuit).toHaveBeenCalledWith(ceremonyId, "user1", data)
        })
    })

    describe("verifyContribution", () => {
        it("should call circuitsService.verifyContribution with correct parameters", async () => {
            const ceremonyId = 1
            const jwt: JWTDto = { user: { id: "user1" } } as JWTDto
            const data: VerifyContributionData = { circuitId: 1, contributorOrCoordinatorIdentifier: "contributor1" }

            await controller.verifyContribution(ceremonyId, { jwt }, data)

            expect(mockCircuitsService.verifyContribution).toHaveBeenCalledWith(ceremonyId, "user1", data)
        })
    })

    describe("getCircuitContributionsFromParticipant", () => {
        it("should call circuitsService.getCircuitContributionsFromParticipant with correct parameters", async () => {
            const ceremonyId = 1
            const circuitId = 1
            const participantId = "participant1"

            await controller.getCircuitContributionsFromParticipant(ceremonyId, circuitId, participantId)

            expect(mockCircuitsService.getCircuitContributionsFromParticipant).toHaveBeenCalledWith(
                ceremonyId,
                circuitId,
                participantId
            )
        })
    })

    describe("getByCeremonyId", () => {
        it("should call circuitsService.getCircuitsOfCeremony and return circuits", async () => {
            const ceremonyId = 1
            const mockCircuits = [
                { id: 1, name: "Circuit 1" },
                { id: 2, name: "Circuit 2" }
            ]
            mockCircuitsService.getCircuitsOfCeremony = jest.fn().mockResolvedValue(mockCircuits)

            const result = await controller.getByCeremonyId(ceremonyId)

            expect(mockCircuitsService.getCircuitsOfCeremony).toHaveBeenCalledWith(ceremonyId)
            expect(result).toEqual({ circuits: mockCircuits })
        })
    })

    describe("getCircuitById", () => {
        it("should call circuitsService.getCircuitById with correct parameters", async () => {
            const ceremonyId = 1
            const circuitId = 1

            await controller.getCircuitById(ceremonyId, circuitId)

            expect(mockCircuitsService.getCircuitById).toHaveBeenCalledWith(ceremonyId, circuitId)
        })
    })

    describe("getContributionById", () => {
        it("should call circuitsService.getContributionById with correct parameters", async () => {
            const ceremonyId = 1
            const circuitId = 1
            const contributionId = 1

            await controller.getContributionById(ceremonyId, circuitId, contributionId)

            expect(mockCircuitsService.getContributionById).toHaveBeenCalledWith(ceremonyId, circuitId, contributionId)
        })
    })

    describe("getContributionsFromCircuit", () => {
        it("should call circuitsService.getContributionsFromCircuit with correct parameters", async () => {
            const ceremonyId = 1
            const circuitId = 1

            await controller.getContributionsFromCircuit(ceremonyId, circuitId)

            expect(mockCircuitsService.getContributionsFromCircuit).toHaveBeenCalledWith(ceremonyId, circuitId)
        })
    })
})
