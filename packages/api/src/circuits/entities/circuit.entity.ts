import { AutoIncrement, Column, DataType, ForeignKey, HasMany, Model, Table } from "sequelize-typescript"
import {
    AvgTimingsDto,
    CompilationArtifactsDto,
    CompilerDto,
    FileDto,
    MetadataDto,
    TemplateDto,
    VerificationDto,
    WaitingQueueDto
} from "../dto/circuits-dto"
import { CeremonyEntity } from "../../ceremonies/entities/ceremony.entity"
import { ContributionEntity } from "./contribution.entity"

@Table
export class CircuitEntity extends Model {
    @AutoIncrement
    @Column({
        type: DataType.INTEGER,
        primaryKey: true,
        allowNull: false
    })
    id: number

    @ForeignKey(() => CeremonyEntity)
    @Column
    ceremonyId: number

    @Column(DataType.JSON)
    compiler: CompilerDto

    @Column(DataType.JSON)
    template: TemplateDto

    @Column(DataType.JSON)
    verification: VerificationDto

    @Column(DataType.JSON)
    compilationArtifacts?: CompilationArtifactsDto

    @Column(DataType.JSON)
    metadata?: MetadataDto

    @Column(DataType.JSON)
    files?: FileDto

    @Column(DataType.JSON)
    avgTimings?: AvgTimingsDto

    @Column(DataType.JSON)
    waitingQueue?: WaitingQueueDto

    @HasMany(() => ContributionEntity)
    contributions: ContributionEntity[]

    @Column
    name?: string

    @Column
    prefix: string

    @Column
    description: string

    @Column
    dynamicThreshold?: number

    @Column
    fixedTimeWindow?: number

    @Column
    sequencePosition?: number

    @Column
    zKeySizeInBytes?: number
}
