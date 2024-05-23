import {
    ParticipantContributionStep,
    ParticipantStatus,
    TemporaryParticipantContributionData,
    TimeoutType
} from "@p0tion/actions"
import { Column, DataType, ForeignKey, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript"
import { UserEntity } from "src/users/entities/user.entity"
import { CeremonyEntity } from "../../ceremonies/entities/ceremony.entity"
import { ContributionEntity } from "../../circuits/entities/contribution.entity"

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

    @HasMany(() => ContributionEntity)
    contributions?: ContributionEntity[]

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
