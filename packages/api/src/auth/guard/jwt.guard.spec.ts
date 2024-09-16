import { Test, TestingModule } from "@nestjs/testing"
import { ExecutionContext, UnauthorizedException } from "@nestjs/common"
import { JWTGuard, extractTokenFromHeader } from "./jwt.guard"
import { JwtService } from "@nestjs/jwt"
import { JWTDto } from "../dto/auth-dto"

describe("JWTGuard", () => {
    let guard: JWTGuard
    let mockJwtService: Partial<JwtService>

    const getCurrentTimestamp = () => Math.floor(Date.now())

    const mockJwtPayload: JWTDto = {
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
        mockJwtService = {
            verifyAsync: jest.fn()
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [JWTGuard, { provide: JwtService, useValue: mockJwtService }]
        }).compile()

        guard = module.get<JWTGuard>(JWTGuard)

        process.env.SUPABASE_JWT_SECRET = "test-secret"
    })

    afterEach(() => {
        jest.resetAllMocks()
        delete process.env.SUPABASE_JWT_SECRET
    })

    it("should be defined", () => {
        expect(guard).toBeDefined()
    })

    it("should allow access with valid JWT", async () => {
        mockJwtService.verifyAsync = jest.fn().mockResolvedValue(mockJwtPayload)

        const mockRequest = {
            headers: { authorization: "Bearer validtoken" }
        }

        const mockContext = {
            switchToHttp: () => ({
                getRequest: () => mockRequest
            })
        } as ExecutionContext

        await expect(guard.canActivate(mockContext)).resolves.toBe(true)
        expect(mockJwtService.verifyAsync).toHaveBeenCalledWith("validtoken", {
            secret: "test-secret"
        })
        expect(mockRequest["jwt"]).toEqual(mockJwtPayload)
    })

    it("should throw UnauthorizedException with invalid JWT", async () => {
        mockJwtService.verifyAsync = jest.fn().mockRejectedValue(new Error())

        const mockContext = {
            switchToHttp: () => ({
                getRequest: () => ({
                    headers: { authorization: "Bearer invalidtoken" }
                })
            })
        } as ExecutionContext

        await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException)
    })

    it("should throw UnauthorizedException with missing authorization header", async () => {
        const mockContext = {
            switchToHttp: () => ({
                getRequest: () => ({
                    headers: {}
                })
            })
        } as ExecutionContext

        await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException)
    })
})

describe("extractTokenFromHeader", () => {
    it("should extract token from valid header", () => {
        expect(extractTokenFromHeader("Bearer token123")).toBe("token123")
    })

    it("should return undefined for invalid header", () => {
        expect(extractTokenFromHeader("Invalid token123")).toBeUndefined()
    })

    it("should return undefined for null or undefined header", () => {
        expect(extractTokenFromHeader(null)).toBeUndefined()
        expect(extractTokenFromHeader(undefined)).toBeUndefined()
    })

    it("should return undefined for empty string", () => {
        expect(extractTokenFromHeader("")).toBeUndefined()
    })

    it("should return undefined for Bearer prefix without token", () => {
        expect(extractTokenFromHeader("Bearer ")).toBeUndefined()
        expect(extractTokenFromHeader("Bearer")).toBeUndefined()
    })
})
