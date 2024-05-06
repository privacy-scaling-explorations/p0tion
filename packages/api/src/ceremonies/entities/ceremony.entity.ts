import { AutoIncrement, Column, DataType, HasMany, Model, Table } from "sequelize-typescript"
import { CeremonyState, CeremonyTimeoutType, CeremonyType } from "@p0tion/actions"
import { CircuitEntity } from "./circuit.entity"

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

    @HasMany(() => CircuitEntity)
    circuits: CircuitEntity[]
}
