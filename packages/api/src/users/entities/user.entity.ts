import { Column, Table, Model, PrimaryKey, AutoIncrement, Unique } from "sequelize-typescript"

@Table({
    tableName: "users"
})
export class User extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number

    @Unique
    @Column
    identifier: string

    @Unique
    @Column
    displayName: string

    @Column
    creationTime: number

    @Column
    lastSignInTime: number

    @Column
    lastUpdated: number

    @Column
    avatarUrl: string
}
