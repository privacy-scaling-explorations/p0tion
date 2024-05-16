import {
    Contribution,
    ParticipantContributionStep,
    ParticipantStatus,
    TemporaryParticipantContributionData
} from "@p0tion/actions"
import { Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript"
import { UserEntity } from "src/users/entities/user.entity"

@Table
export class ParticipantEntity extends Model {
    @ForeignKey(() => UserEntity)
    @Column
    userId: number

    @Column
    contributionProgress: number

    @Column
    status: ParticipantStatus

    @Column({ type: DataType.ARRAY(DataType.JSON), allowNull: true })
    contributions: Contribution[]

    @Column
    lastUpdated: number

    @Column
    contributionStartedAt: number

    @Column
    contributionStep?: ParticipantContributionStep

    @Column
    verificationStartedAt?: number

    @Column
    tempContributionData?: TemporaryParticipantContributionData
}
