import { Column, Table, Model, PrimaryKey } from "sequelize-typescript"

export class User {
    @PrimaryKey
    @Column
    id: string

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
export class UserEntity extends Model {
    @PrimaryKey
    @Column
    id: string

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
