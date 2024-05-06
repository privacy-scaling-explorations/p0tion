import { AutoIncrement, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript"
import { CeremonyEntity } from "./ceremony.entity"

@Table
export class CircuitMetadataEntity extends Model {
    curve: string
    wires: number
    constraints: number
    privateInputs: number
    publicInputs: number
    labels: number
    outputs: number
    pot: number

    @ForeignKey(() => CircuitEntity)
    @Column
    circuitId: number
}

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

    /*@HasOne(() => CircuitMetadataEntity)
    metadata: CircuitMetadataEntity*/
}

/*
export type CircuitMetadata = {
    curve: string
    wires: number
    constraints: number
    privateInputs: number
    publicInputs: number
    labels: number
    outputs: number
    pot: number
}
*/
