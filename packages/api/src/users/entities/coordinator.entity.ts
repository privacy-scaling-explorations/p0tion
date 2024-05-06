import { Column, Model, PrimaryKey, Table } from "sequelize-typescript"

export class Coordinator {
    id: string
}

@Table
export class CoordinatorEntity extends Model {
    @PrimaryKey
    @Column
    id: string

    @Column
    ceremonyId: string
}
