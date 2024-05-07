import { AutoIncrement, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript"
import { CeremonyEntity } from "./ceremony.entity"
import { CircuitContributionVerificationMechanism, DiskTypeForVM } from "@p0tion/actions"

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
    compiler: {
        version: string
        commitHash: string
    }

    @Column(DataType.JSON)
    template: {
        source: string
        commitHash: string
        paramsConfiguration: Array<string>
    }

    @Column(DataType.JSON)
    verification: {
        cfOrVm: CircuitContributionVerificationMechanism
        vm?: {
            vmConfigurationType?: string
            vmDiskType?: DiskTypeForVM
            vmDiskSize?: number
            vmInstanceId?: string
        }
    }

    @Column(DataType.JSON)
    compilationArtifacts?: {
        r1csFilename: string
        wasmFilename: string
    }

    @Column(DataType.JSON)
    metadata?: {
        curve: string
        wires: number
        constraints: number
        privateInputs: number
        publicInputs: number
        labels: number
        outputs: number
        pot: number
    }

    @Column(DataType.JSON)
    files?: {
        potFilename: string
        r1csFilename: string
        wasmFilename: string
        initialZkeyFilename: string
        potStoragePath: string
        r1csStoragePath: string
        wasmStoragePath: string
        initialZkeyStoragePath: string
        potBlake2bHash: string
        r1csBlake2bHash: string
        wasmBlake2bHash: string
        initialZkeyBlake2bHash: string
    }

    @Column(DataType.JSON)
    avgTimings?: {
        contributionComputation: number
        fullContribution: number
        verifyCloudFunction: number
    }

    @Column(DataType.JSON)
    waitingQueue?: {
        completedContributions: number
        contributors: Array<string>
        currentContributor: string
        failedContributions: number
    }

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
    prefix?: string

    @Column
    zKeySizeInBytes?: number
}
