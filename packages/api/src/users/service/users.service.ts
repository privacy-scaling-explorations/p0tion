import { Injectable } from "@nestjs/common"
import { UpdateUserDto } from "../dto/update-user.dto"
import { InjectModel } from "@nestjs/sequelize"
import { User, UserEntity } from "../entities/user.entity"

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(UserEntity)
        private userModel: typeof UserEntity
    ) {}

    async create(createUser: User) {
        try {
            const user = await this.userModel.create(createUser as any)
            return user
        } catch (error) {
            return this.handleCreationErrors(error as Error)
        }
    }

    async findOrCreate(createUser: User) {
        try {
            const [user, created] = await this.userModel.findOrCreate({
                where: {
                    id: createUser.id
                },
                defaults: createUser as any
            })
            return { user, created }
        } catch (error) {
            return this.handleCreationErrors(error as Error)
        }
    }

    findAll() {
        return `This action returns all users`
    }

    findByIds(ids: string[]) {
        const users = this.userModel.findAll({
            where: {
                id: ids
            }
        })
        return users
    }

    findOne(id: number) {
        return `This action returns a #${id} user`
    }

    update(id: number, updateUserDto: UpdateUserDto) {
        console.log(updateUserDto)
        return `This action updates a #${id} user`
    }

    remove(id: number) {
        return `This action removes a #${id} user`
    }

    handleCreationErrors(error: Error) {
        if (error.name === "SequelizeUniqueConstraintError") {
            error.message = "User already exists"
        }
        return {
            message: error.message,
            name: error.name,
            user: null
        }
    }
}
