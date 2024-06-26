import { Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript"
import { BeaconInfo, ContributionFiles, ContributionVerificationSoftware } from "../dto/contribution-dto"
import { ParticipantEntity } from "../../participants/entities/participant.entity"
import { CircuitEntity } from "./circuit.entity"

@Table
export class ContributionEntity extends Model {
    @ForeignKey(() => ParticipantEntity)
    @Column
    participantUserId: string

    @ForeignKey(() => ParticipantEntity)
    @Column
    participantCeremonyId: number

    @ForeignKey(() => CircuitEntity)
    circuitId: number

    @Column
    contributionComputationTime: number

    @Column
    verificationComputationTime: number

    @Column
    zkeyIndex: string

    @Column({ type: DataType.JSON })
    files: ContributionFiles

    @Column({ type: DataType.JSON })
    verificationSoftware: ContributionVerificationSoftware

    @Column
    valid: boolean

    @Column
    lastUpdated: number

    @Column({ type: DataType.JSON })
    beacon?: BeaconInfo
}
