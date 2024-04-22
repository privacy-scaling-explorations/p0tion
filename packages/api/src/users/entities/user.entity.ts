import { Column, Table, Model } from "sequelize-typescript"

@Table({
    tableName: "users"
})
export class User extends Model {
    @Column
    id: string

    @Column
    email: string

    @Column
    name: string

    @Column
    creationTime: number

    @Column
    lastSignInTime: number

    @Column
    lastUpdated: number
}
