import {
    Contribution,
    ParticipantContributionStep,
    ParticipantStatus,
    TemporaryParticipantContributionData
} from "@p0tion/actions"
import { Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript"
import { UserEntity } from "src/users/entities/user.entity"
import { CeremonyEntity } from "../../ceremonies/entities/ceremony.entity"

@Table
export class ParticipantEntity extends Model {
    @ForeignKey(() => UserEntity)
    @Column
    userId: string

    @ForeignKey(() => CeremonyEntity)
    @Column
    ceremonyId: number

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

    @Column({ type: DataType.JSON })
    tempContributionData?: TemporaryParticipantContributionData
}
