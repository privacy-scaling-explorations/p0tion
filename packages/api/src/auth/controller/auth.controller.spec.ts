import { Test, TestingModule } from "@nestjs/testing"
import { AuthController } from "./auth.controller"
import { AuthService } from "../service/auth.service"
import { DeviceFlowTokenDto } from "../dto/auth-dto"

describe("AuthController", () => {
    let controller: AuthController
    let authService: AuthService

    const mockAuthService = {
        getGithubClientId: jest.fn(),
        getUserInfoFromGithub: jest.fn()
    }

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: mockAuthService
                }
            ]
        }).compile()

        controller = module.get<AuthController>(AuthController)
        authService = module.get<AuthService>(AuthService)
    })

    it("should be defined", () => {
        expect(controller).toBeDefined()
    })

    describe("githubClientId", () => {
        it("should return the GitHub client ID", async () => {
            const mockClientId = { client_id: "test-client-id" }
            mockAuthService.getGithubClientId.mockResolvedValue(mockClientId)

            const result = await controller.githubClientId()

            expect(authService.getGithubClientId).toHaveBeenCalled()
            expect(result).toEqual(mockClientId)
        })
    })

    describe("githubUser", () => {
        it("should return user info from GitHub", async () => {
            const mockDeviceFlowTokenDto: DeviceFlowTokenDto = {
                access_token: "test-token",
                token_type: "bearer"
            }
            const mockUserInfo = {
                user: {
                    id: "testuser",
                    displayName: "Test User",
                    avatarUrl: "https://example.com/avatar.jpg"
                },
                jwt: "test-jwt-token"
            }
            mockAuthService.getUserInfoFromGithub.mockResolvedValue(mockUserInfo)

            const result = await controller.githubUser(mockDeviceFlowTokenDto)

            expect(authService.getUserInfoFromGithub).toHaveBeenCalledWith(mockDeviceFlowTokenDto)
            expect(result).toEqual(mockUserInfo)
        })
    })
})
