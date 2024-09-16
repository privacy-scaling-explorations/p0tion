import { Test, TestingModule } from "@nestjs/testing"
import { ExecutionContext, UnauthorizedException } from "@nestjs/common"
import { CoordinatorGuard } from "./coordinator.guard"
import { CeremoniesService } from "../../ceremonies/service/ceremonies.service"
import { JWTDto } from "../../auth/dto/auth-dto"

describe("CoordinatorGuard", () => {
    let guard: CoordinatorGuard
    let mockCeremoniesService: Partial<CeremoniesService>

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
        mockCeremoniesService = {
            isCoordinator: jest.fn()
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [CoordinatorGuard, { provide: CeremoniesService, useValue: mockCeremoniesService }]
        }).compile()

        guard = module.get<CoordinatorGuard>(CoordinatorGuard)
    })

    it("should be defined", () => {
        expect(guard).toBeDefined()
    })

    it("should allow access for coordinator", async () => {
        mockCeremoniesService.isCoordinator = jest.fn().mockResolvedValue({ isCoordinator: true })

        const mockContext = {
            switchToHttp: () => ({
                getRequest: () => ({
                    jwt: mockJwt,
                    query: { ceremonyId: 1 }
                })
            })
        } as ExecutionContext

        await expect(guard.canActivate(mockContext)).resolves.toBe(true)
        expect(mockCeremoniesService.isCoordinator).toHaveBeenCalledWith("user1", 1)
    })

    it("should throw UnauthorizedException for non-coordinator", async () => {
        mockCeremoniesService.isCoordinator = jest.fn().mockResolvedValue({ isCoordinator: false })

        const mockContext = {
            switchToHttp: () => ({
                getRequest: () => ({
                    jwt: mockJwt,
                    query: { ceremonyId: 1 }
                })
            })
        } as ExecutionContext

        await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException)
        expect(mockCeremoniesService.isCoordinator).toHaveBeenCalledWith("user1", 1)
    })
})
