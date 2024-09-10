import { Test, TestingModule } from "@nestjs/testing"
import { UsersService } from "./users.service"
import { getModelToken } from "@nestjs/sequelize"
import { UserEntity, User } from "../entities/user.entity"
import { CreateUserDto } from "../dto/create-user.dto"
import { UpdateUserDto } from "../dto/update-user.dto"

describe("UsersService", () => {
    let service: UsersService
    let mockUserModel: any
    // mockUser as the value returned by the model, simulating the user created in the database
    const mockUser: User = {
        id: "1",
        displayName: "nath",
        creationTime: Date.now(),
        lastSignInTime: Date.now(),
        lastUpdated: Date.now(),
        avatarUrl: "https://example.com/avatar.jpg",
        provider: "github"
    }

    // mockCreateUserDto as input to the create method, simulating the data a client would send
    const mockCreateUserDto: CreateUserDto = {
        id: "1",
        displayName: "nath",
        creationTime: Date.now(),
        lastSignInTime: Date.now(),
        lastUpdated: Date.now(),
        avatarUrl: "https://example.com/avatar.jpg",
        provider: "github"
    }

    const mockUpdateUserDto: UpdateUserDto = {
        displayName: "nath Updated",
        avatarUrl: "https://example.com/new-avatar.jpg"
    }

    beforeEach(async () => {
        mockUserModel = {
            create: jest.fn(),
            findOrCreate: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            destroy: jest.fn()
        }
        // const module: TestingModule = await Test.createTestingModule({
        //     providers: [UsersService]
        // }).compile()

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                {
                    provide: getModelToken(UserEntity),
                    useValue: mockUserModel
                }
            ]
        }).compile()

        service = module.get<UsersService>(UsersService)
    })

    it("should be defined", () => {
        expect(service).toBeDefined()
    })

    describe("create", () => {
        it("should create a user successfully", async () => {
            mockUserModel.create.mockResolvedValue(mockUser)

            const result = await service.create(mockCreateUserDto)

            expect(mockUserModel.create).toHaveBeenCalledWith(mockCreateUserDto)
            expect(result).toEqual(mockUser)
        })

        it("should handle unique constraint user creation error", async () => {
            const mockError = new Error("User already exists")
            mockError.name = "SequelizeUniqueConstraintError"
            mockUserModel.create.mockRejectedValue(mockError)

            const result = await service.create(mockCreateUserDto)

            expect(result).toEqual({
                message: "User already exists",
                name: "SequelizeUniqueConstraintError",
                statusCode: 409,
                user: null
            })
        })
    })

    describe("findOrCreate", () => {
        it("should find or create a user successfully", async () => {
            mockUserModel.findOrCreate.mockResolvedValue([mockUser, true])

            const result = await service.findOrCreate(mockCreateUserDto)

            expect(mockUserModel.findOrCreate).toHaveBeenCalledWith({
                where: { id: mockUser.id },
                defaults: mockUser
            })
            expect(result).toEqual({ user: mockUser, created: true })
        })

        it("should handle database error", async () => {
            const mockError = new Error("Database error occurred")
            mockError.name = "SequelizeDatabaseError"
            mockUserModel.findOrCreate.mockRejectedValue(mockError)

            const result = await service.findOrCreate(mockCreateUserDto)

            expect(result).toEqual({
                message: "Database error occurred",
                name: "SequelizeDatabaseError",
                statusCode: 500,
                user: null
            })
        })
    })

    describe("findAll", () => {
        it("should return all users", async () => {
            const mockUsers = [mockUser, { ...mockUser, id: "2", displayName: "nico" }]
            mockUserModel.findAll.mockResolvedValue(mockUsers)

            const result = await service.findAll()

            expect(mockUserModel.findAll).toHaveBeenCalled()
            expect(result).toEqual(mockUsers)
        })

        it("should handle database error when fetching all users", async () => {
            const mockError = new Error("Database error occurred")
            mockError.name = "SequelizeDatabaseError"
            mockUserModel.findAll.mockRejectedValue(mockError)

            const result = await service.findAll()

            expect(result).toEqual({
                message: "Database error occurred",
                name: "SequelizeDatabaseError",
                statusCode: 500,
                user: null
            })
        })
    })

    describe("findByIds", () => {
        it("should find users by ids", async () => {
            const mockUsers = [mockUser, { ...mockUser, id: "2", displayName: "nico" }]
            mockUserModel.findAll.mockResolvedValue(mockUsers)

            const result = await service.findByIds(["1", "2"])

            expect(mockUserModel.findAll).toHaveBeenCalledWith({
                where: { id: ["1", "2"] }
            })
            expect(result).toEqual(mockUsers)
        })

        it("should handle database error when finding users by ids", async () => {
            const mockError = new Error("Database error occurred")
            mockError.name = "SequelizeDatabaseError"
            mockUserModel.findAll.mockRejectedValue(mockError)

            const result = await service.findByIds(["1", "2"])

            expect(result).toEqual({
                message: "Database error occurred",
                name: "SequelizeDatabaseError",
                statusCode: 500,
                user: null
            })
        })
    })

    describe("findOne", () => {
        it("should find a user by id", async () => {
            mockUserModel.findOne.mockResolvedValue(mockUser)

            const result = await service.findOne("1")

            expect(mockUserModel.findOne).toHaveBeenCalledWith({ where: { id: "1" } })
            expect(result).toEqual(mockUser)
        })

        it("should handle user not found", async () => {
            mockUserModel.findOne.mockResolvedValue(null)

            const result = await service.findOne("1")

            expect(result).toEqual({
                message: "User not found",
                name: "Error",
                statusCode: 404,
                user: null
            })
        })
    })

    describe("update", () => {
        it("should update a user", async () => {
            const updatedUser = { ...mockUser, ...mockUpdateUserDto }
            mockUserModel.update.mockResolvedValue([1])
            mockUserModel.findOne.mockResolvedValue(updatedUser)

            const result = await service.update("1", mockUpdateUserDto)

            expect(mockUserModel.update).toHaveBeenCalledWith(mockUpdateUserDto, { where: { id: "1" } })
            expect(mockUserModel.findOne).toHaveBeenCalledWith({ where: { id: "1" } })
            expect(result).toEqual(updatedUser)
        })

        it("should handle user not found during update", async () => {
            mockUserModel.update.mockResolvedValue([0])

            const result = await service.update("1", mockUpdateUserDto)

            expect(result).toEqual({
                message: "User not found",
                name: "Error",
                statusCode: 404,
                user: null
            })
        })
    })

    describe("remove", () => {
        it("should remove a user", async () => {
            mockUserModel.destroy.mockResolvedValue(1)

            const result = await service.remove("1")

            expect(mockUserModel.destroy).toHaveBeenCalledWith({ where: { id: "1" } })
            expect(result).toBe(true)
        })

        it("should handle user not found during removal", async () => {
            mockUserModel.destroy.mockResolvedValue(0)

            const result = await service.remove("1")

            expect(result).toEqual({
                message: "User not found",
                name: "Error",
                statusCode: 404,
                user: null
            })
        })
    })
})
