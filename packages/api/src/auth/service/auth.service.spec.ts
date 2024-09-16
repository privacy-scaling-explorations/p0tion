import { Test, TestingModule } from "@nestjs/testing"
import { AuthService } from "./auth.service"
import { JwtService } from "@nestjs/jwt"
import { UsersService } from "../../users/service/users.service"
import { DeviceFlowTokenDto, GithubUser } from "../dto/auth-dto"
import { CreateUserDto } from "../../users/dto/create-user.dto"

describe("AuthService", () => {
    let service: AuthService
    let jwtService: JwtService
    let usersService: UsersService

    const mockJwtService = {
        signAsync: jest.fn()
    }

    const mockUsersService = {
        findOrCreate: jest.fn()
    }

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: JwtService, useValue: mockJwtService },
                { provide: UsersService, useValue: mockUsersService }
            ]
        }).compile()

        service = module.get<AuthService>(AuthService)
        jwtService = module.get<JwtService>(JwtService)
        usersService = module.get<UsersService>(UsersService)

        // Mock fetch globally to simulate GitHub API response
        global.fetch = jest.fn(() =>
            Promise.resolve({
                json: () =>
                    Promise.resolve({
                        login: "testuser",
                        avatar_url: "https://example.com/avatar.jpg",
                        email: "testuser@example.com"
                    } as Partial<GithubUser>)
            })
        ) as jest.Mock
    })

    it("should be defined", () => {
        expect(service).toBeDefined()
    })

    describe("getGithubClientId", () => {
        it("should return the GitHub client ID", () => {
            process.env.GITHUB_CLIENT_ID = "test-client-id"
            const result = service.getGithubClientId()
            // console.log("getGithubClientId returned:", result)
            expect(result).toEqual({ client_id: "test-client-id" })
        })
    })

    describe("getUserInfoFromGithub", () => {
        it("should get user info from GitHub and create or find a user", async () => {
            const deviceFlowTokenDto: DeviceFlowTokenDto = {
                access_token: "test-token",
                token_type: "bearer"
            }
            const mockUser: CreateUserDto = {
                id: "testuser",
                displayName: "testuser",
                creationTime: expect.any(Number),
                lastSignInTime: expect.any(Number),
                lastUpdated: expect.any(Number),
                avatarUrl: "https://example.com/avatar.jpg",
                provider: "github"
            }
            mockUsersService.findOrCreate.mockResolvedValue({ user: mockUser })
            mockJwtService.signAsync.mockResolvedValue("test-jwt-token")

            const result = await service.getUserInfoFromGithub(deviceFlowTokenDto)

            expect(global.fetch).toHaveBeenCalledWith("https://api.github.com/user", {
                headers: { Authorization: "token test-token" }
            })
            expect(mockUsersService.findOrCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: "testuser",
                    displayName: "testuser",
                    avatarUrl: "https://example.com/avatar.jpg",
                    provider: "github"
                })
            )
            expect(mockJwtService.signAsync).toHaveBeenCalledWith({ user: mockUser })
            expect(result).toEqual({ user: mockUser, jwt: "test-jwt-token" })
        })

        it("should handle errors", async () => {
            const deviceFlowTokenDto: DeviceFlowTokenDto = {
                access_token: "test-token",
                token_type: "bearer"
            }
            const mockError = new Error("Test error")
            global.fetch = jest.fn(() => Promise.reject(mockError)) as jest.Mock

            const result = await service.getUserInfoFromGithub(deviceFlowTokenDto)

            expect(result).toBe(mockError)
        })
    })
})
