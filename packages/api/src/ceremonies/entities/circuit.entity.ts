import { AutoIncrement, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript"
import { CeremonyEntity } from "./ceremony.entity"
import {
    AvgTimingsDto,
    CompilationArtifactsDto,
    CompilerDto,
    FileDto,
    MetadataDto,
    TemplateDto,
    VerificationDto,
    WaitingQueueDto
} from "../dto/circuit-dto"

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

    @Column
    name?: string

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
