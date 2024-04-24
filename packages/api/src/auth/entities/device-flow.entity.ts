import { Column, Table, Model, PrimaryKey } from "sequelize-typescript"

export class DeviceFlow {
    deviceCode: string
    initialTime: number
}

@Table({
    tableName: "device-flow"
})
export class DeviceFlowEntity extends Model {
    @PrimaryKey
    @Column
    deviceCode: string

    @Column
    initialTime: number
}
