import { Test, TestingModule } from "@nestjs/testing"
import { ExecutionContext, UnauthorizedException } from "@nestjs/common"
import { AdminGuard } from "./admin.guard"
import { UsersService } from "../../users/service/users.service"

describe("AdminGuard", () => {
    let guard: AdminGuard
    let mockUsersService: Partial<UsersService>

    const createMockContext = (userId: string): ExecutionContext =>
        ({
            switchToHttp: () => ({
                getRequest: () => ({ jwt: { id: userId } })
            })
        }) as ExecutionContext

    beforeEach(async () => {
        mockUsersService = {}
        process.env.ADMIN_ID = "admin123"

        const module: TestingModule = await Test.createTestingModule({
            providers: [AdminGuard, { provide: UsersService, useValue: mockUsersService }]
        }).compile()

        guard = module.get<AdminGuard>(AdminGuard)
    })

    it("should be defined", () => {
        expect(guard).toBeDefined()
    })

    it("should allow access for admin", () => {
        const mockContext = createMockContext("admin123")
        expect(guard.canActivate(mockContext)).toBe(true)
    })

    it("should throw UnauthorizedException for non-admin", () => {
        const mockContext = createMockContext("user123")
        expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException)
    })
})
