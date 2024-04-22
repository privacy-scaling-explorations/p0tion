import { Injectable } from "@nestjs/common"
import { CreateUserDto } from "../dto/create-user.dto"
import { UpdateUserDto } from "../dto/update-user.dto"
import { InjectModel } from "@nestjs/sequelize"
import { User } from "../entities/user.entity"

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User)
        private userModel: typeof User
    ) {}

    async create(createUserDto: CreateUserDto) {
        try {
            const user = await this.userModel.create(createUserDto as any)
            return user
        } catch (error) {
            const result = error as Error
            if (result.name === "SequelizeUniqueConstraintError") {
                result.message = "User already exists"
            }
            return {
                message: result.message,
                name: result.name
            }
        }
    }

    findAll() {
        return `This action returns all users`
    }

    findOne(id: number) {
        return `This action returns a #${id} user`
    }

    update(id: number, updateUserDto: UpdateUserDto) {
        return `This action updates a #${id} user`
    }

    remove(id: number) {
        return `This action removes a #${id} user`
    }
}
