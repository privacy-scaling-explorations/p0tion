import { AutoIncrement, Column, DataType, ForeignKey, HasMany, Model, Table } from "sequelize-typescript"
import { CeremonyState, CeremonyTimeoutType, CeremonyType } from "@p0tion/actions"
import { CircuitEntity } from "./circuit.entity"
import { AuthProvider } from "src/types/enums"
import { GithubDto } from "../dto/github-dto"
import { SiweDto } from "../dto/siwe-dto"
import { BandadaDto } from "../dto/bandada-dto"
import { UserEntity } from "src/users/entities/user.entity"
import { ParticipantEntity } from "./participant.entity"

@Table
export class CeremonyEntity extends Model {
    @AutoIncrement
    @Column({
        type: DataType.INTEGER,
        primaryKey: true,
        allowNull: false
    })
    id: number

    @Column
    prefix: string

    @Column
    state: CeremonyState

    @Column
    type: CeremonyType

    @ForeignKey(() => UserEntity)
    @Column
    coordinatorId: string

    @Column
    title: string

    @Column
    description: string

    @Column
    startDate: number

    @Column
    endDate: number

    @Column
    timeoutMechanismType: CeremonyTimeoutType

    @Column
    penalty: number

    @Column({ type: DataType.TEXT })
    get authProviders(): AuthProvider[] {
        return JSON.parse(this.getDataValue("authProviders"))
    }

    set authProviders(value: AuthProvider[]) {
        this.setDataValue("authProviders", JSON.stringify(value))
    }

    @Column({ type: DataType.JSON, allowNull: true })
    github?: GithubDto

    @Column({ type: DataType.JSON, allowNull: true })
    siwe?: SiweDto

    @Column({ type: DataType.JSON, allowNull: true })
    bandada?: BandadaDto

    @HasMany(() => CircuitEntity)
    circuits: CircuitEntity[]

    @HasMany(() => ParticipantEntity)
    participants: ParticipantEntity[]
}
