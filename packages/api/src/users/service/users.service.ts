import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/sequelize"
import { CreateUserDto } from "../dto/create-user.dto"
import { UpdateUserDto } from "../dto/update-user.dto"
import { User, UserEntity } from "../entities/user.entity"

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(UserEntity)
        private userModel: typeof UserEntity
    ) {}

    async create(
        createUserDto: CreateUserDto
    ): Promise<User | { message: string; name: string; statusCode: number; user: null }> {
        try {
            const user = await this.userModel.create(createUserDto as any)
            return user
        } catch (error) {
            return this.handleErrors(error as Error)
        }
    }

    async findOrCreate(
        createUserDto: CreateUserDto
    ): Promise<{ user: User; created: boolean } | { message: string; name: string; statusCode: number; user: null }> {
        try {
            const [user, created] = await this.userModel.findOrCreate({
                where: {
                    id: createUserDto.id
                },
                defaults: createUserDto as any
            })
            return { user, created }
        } catch (error) {
            return this.handleErrors(error as Error)
        }
    }

    async findAll(): Promise<User[] | { message: string; name: string; statusCode: number; user: null }> {
        try {
            const users = await this.userModel.findAll()
            return users
        } catch (error) {
            return this.handleErrors(error as Error)
        }
    }

    async findByIds(
        ids: string[]
    ): Promise<User[] | { message: string; name: string; statusCode: number; user: null }> {
        try {
            const users = await this.userModel.findAll({
                where: {
                    id: ids
                }
            })
            return users
        } catch (error) {
            return this.handleErrors(error as Error)
        }
    }

    async findOne(id: string): Promise<User | { message: string; name: string; statusCode: number; user: null }> {
        try {
            const user = await this.userModel.findOne({ where: { id } })
            if (!user) {
                throw new Error("User not found")
            }
            return user
        } catch (error) {
            return this.handleErrors(error as Error)
        }
    }

    async update(
        id: string,
        updateUserDto: UpdateUserDto
    ): Promise<User | { message: string; name: string; statusCode: number; user: null }> {
        try {
            const [updatedCount] = await this.userModel.update(updateUserDto, {
                where: { id }
            })
            if (updatedCount === 0) {
                throw new Error("User not found")
            }
            const updatedUser = await this.userModel.findOne({ where: { id } })
            return updatedUser
        } catch (error) {
            return this.handleErrors(error as Error)
        }
    }

    async remove(id: string): Promise<boolean | { message: string; name: string; statusCode: number; user: null }> {
        try {
            const deletedCount = await this.userModel.destroy({ where: { id } })
            if (deletedCount === 0) {
                throw new Error("User not found")
            }
            return true
        } catch (error) {
            return this.handleErrors(error as Error)
        }
    }

    // findAll() {
    //     // return `This action returns all users`
    //     try {
    //     } catch (error) {
    //         return this.handleErrors(error as Error)
    //     }
    // }

    // findByIds(ids: string[]) {
    //     const users = this.userModel.findAll({
    //         where: {
    //             id: ids
    //         }
    //     })
    //     return users
    // }

    // findOne(id: number) {
    //     return `This action returns a #${id} user`
    // }

    // update(id: number, updateUserDto: UpdateUserDto) {
    //     console.log(updateUserDto)
    //     return `This action updates a #${id} user`
    // }

    // remove(id: number) {
    //     return `This action removes a #${id} user`
    // }

    handleErrors(error: Error): { message: string; name: string; statusCode: number; user: null } {
        let message = error.message
        let statusCode = 500

        switch (error.name) {
            case "SequelizeUniqueConstraintError":
                message = "User already exists"
                statusCode = 409 // Conflict
                break
            case "SequelizeValidationError":
                message = "Invalid user data"
                statusCode = 400 // Bad Request
                break
            case "SequelizeForeignKeyConstraintError":
                message = "Invalid reference to a related entity"
                statusCode = 400 // Bad Request
                break
            case "SequelizeTimeoutError":
                message = "Database operation timed out"
                statusCode = 504 // Gateway Timeout
                break
            case "SequelizeConnectionError":
                message = "Failed to connect to the database"
                statusCode = 503 // Service Unavailable
                break
            case "SequelizeDatabaseError":
                message = "Database error occurred"
                statusCode = 500 // Internal Server Error
                break
            case "JsonWebTokenError":
                message = "Invalid token"
                statusCode = 401 // Unauthorized
                break
            case "TokenExpiredError":
                message = "Token has expired"
                statusCode = 401 // Unauthorized
                break
            case "Error":
                if (error.message === "User not found") {
                    statusCode = 404 // Not Found
                } else if (error.message === "Insufficient permissions") {
                    message = "You don't have permission to perform this action"
                    statusCode = 403 // Forbidden
                }
                break
            default:
                message = "An unexpected error occurred"
                statusCode = 500 // Internal Server Error
        }

        return {
            message,
            name: error.name,
            statusCode,
            user: null
        }
    }
    // handleCreationErrors(error: Error) {
    //     if (error.name === "SequelizeUniqueConstraintError") {
    //         error.message = "User already exists"
    //     }
    //     return {
    //         message: error.message,
    //         name: error.name,
    //         user: null
    //     }
    // }
}
