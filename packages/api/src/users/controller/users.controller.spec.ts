import { Test, TestingModule } from "@nestjs/testing"
import { UsersController } from "./users.controller"
import { UsersService } from "../service/users.service"
import { CreateUserDto } from "../dto/create-user.dto"
import { UpdateUserDto } from "../dto/update-user.dto"

describe("UsersController", () => {
    let controller: UsersController
    let service: UsersService

    // beforeEach(async () => {
    //     const module: TestingModule = await Test.createTestingModule({
    //         controllers: [UsersController],
    //         providers: [UsersService]
    //     }).compile()

    //     controller = module.get<UsersController>(UsersController)
    // })

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                {
                    provide: UsersService,
                    useValue: {
                        create: jest.fn(),
                        findAll: jest.fn(),
                        findByIds: jest.fn(),
                        findOne: jest.fn(),
                        update: jest.fn(),
                        remove: jest.fn()
                    }
                }
            ]
        }).compile()

        controller = module.get<UsersController>(UsersController)
        service = module.get<UsersService>(UsersService)
    })

    it("should be defined", () => {
        expect(controller).toBeDefined()
    })

    describe("create", () => {
        it("should create a user", async () => {
            const createUserDto: CreateUserDto = {
                id: "1",
                displayName: "Test User",
                creationTime: Date.now(),
                lastSignInTime: Date.now(),
                lastUpdated: Date.now(),
                avatarUrl: "https://example.com/avatar.jpg",
                provider: "github"
            }
            jest.spyOn(service, "create").mockResolvedValue(createUserDto as any)

            expect(await controller.create(createUserDto)).toBe(createUserDto)
            expect(service.create).toHaveBeenCalledWith(createUserDto)
        })
    })

    describe("findAll", () => {
        it("should return an array of users", async () => {
            const result = [{ id: "1", name: "Test User" }]
            jest.spyOn(service, "findAll").mockResolvedValue(result as any)

            expect(await controller.findAll()).toBe(result)
        })
    })

    describe("findByIds", () => {
        it("should return users by ids", async () => {
            const ids = ["1", "2"]
            const result = [
                { id: "1", name: "Test User 1" },
                { id: "2", name: "Test User 2" }
            ]
            jest.spyOn(service, "findByIds").mockResolvedValue(result as any)

            expect(await controller.findByIds(ids)).toBe(result)
            expect(service.findByIds).toHaveBeenCalledWith(ids)
        })
    })

    describe("findOne", () => {
        it("should return a user", async () => {
            const result = { id: "1", name: "Test User" }
            jest.spyOn(service, "findOne").mockResolvedValue(result as any)

            expect(await controller.findOne("1")).toBe(result)
            expect(service.findOne).toHaveBeenCalledWith("1")
        })
    })

    describe("update", () => {
        it("should update a user", async () => {
            const updateUserDto: UpdateUserDto = { displayName: "Updated User" }
            const result = { id: "1", name: "Updated User" }
            jest.spyOn(service, "update").mockResolvedValue(result as any)

            expect(await controller.update("1", updateUserDto)).toBe(result)
            expect(service.update).toHaveBeenCalledWith("1", updateUserDto)
        })
    })

    describe("remove", () => {
        it("should remove a user", async () => {
            jest.spyOn(service, "remove").mockResolvedValue(true as never)

            expect(await controller.remove("1")).toBe(true)
            expect(service.remove).toHaveBeenCalledWith("1")
        })
    })
})
