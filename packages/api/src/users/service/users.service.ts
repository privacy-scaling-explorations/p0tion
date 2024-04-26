import { Injectable } from "@nestjs/common"
import { UpdateUserDto } from "../dto/update-user.dto"
import { InjectModel } from "@nestjs/sequelize"
import { User, UserEntity } from "../entities/user.entity"
import { CoordinatorEntity } from "../entities/coordinator.entity"

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(UserEntity)
        private userModel: typeof UserEntity,
        @InjectModel(CoordinatorEntity)
        private coordinatorModel: typeof CoordinatorEntity
    ) {}

    async create(createUser: User) {
        try {
            const user = await this.userModel.create(createUser as any)
            return user
        } catch (error) {
            return this.handleCreationErrors(error as Error)
        }
    }

    async createCoordinator(createCoordinator: CoordinatorEntity) {
        try {
            const coordinator = await this.coordinatorModel.create(createCoordinator as any)
            return coordinator
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

    findCoordinator(id: string) {
        const coordinator = this.coordinatorModel.findOne({
            where: {
                id
            }
        })
        return coordinator
    }

    update(id: number, updateUserDto: UpdateUserDto) {
        console.log(updateUserDto)
        return `This action updates a #${id} user`
    }

    remove(id: number) {
        return `This action removes a #${id} user`
    }

    async removeCoordinator(id: string) {
        const coordinator = await this.coordinatorModel.findOne({
            where: {
                id
            }
        })
        if (coordinator) {
            await coordinator.destroy()
            return { message: "Coordinator removed", coordinator }
        } else {
            return { message: "Coordinator not found", coordinator: null }
        }
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
