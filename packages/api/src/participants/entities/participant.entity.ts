import {
    ParticipantContributionStep,
    ParticipantStatus,
    TemporaryParticipantContributionData,
    TimeoutType
} from "@p0tion/actions"
import { Column, DataType, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript"
import { UserEntity } from "src/users/entities/user.entity"
import { CeremonyEntity } from "../../ceremonies/entities/ceremony.entity"

export type Contribution = {
    computationTime: number
    id: number
    hash: string
}

type Timeout = {
    endDate: number
    startDate: number
    type: TimeoutType
}

@Table
export class ParticipantEntity extends Model {
    @ForeignKey(() => UserEntity)
    @PrimaryKey
    @Column
    userId: string

    @ForeignKey(() => CeremonyEntity)
    @PrimaryKey
    @Column
    ceremonyId: number

    @Column
    contributionProgress: number

    @Column
    status: ParticipantStatus

    @Column({ type: DataType.ARRAY(DataType.JSON), allowNull: true })
    contributions?: Contribution[]

    @Column
    contributionStartedAt: number

    @Column
    contributionStep?: ParticipantContributionStep

    @Column
    verificationStartedAt?: number

    @Column({ type: DataType.JSON })
    tempContributionData?: TemporaryParticipantContributionData

    @Column({ type: DataType.ARRAY(DataType.JSON), allowNull: true })
    timeout?: Timeout[]
}
