import { Column, Table, Model, PrimaryKey, AutoIncrement, Unique } from "sequelize-typescript"

export class User {
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

@Table({
    tableName: "users"
})
export class UserEntity extends Model<User> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id?: number
}
