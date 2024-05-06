import { Column, Table, Model, PrimaryKey } from "sequelize-typescript"

export class User {
    id: string
    displayName: string
    creationTime: number
    lastSignInTime: number
    lastUpdated: number
    avatarUrl: string
    provider: "github" | "siwe" | "bandada"
}

@Table
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

    @Column
    provider: "github" | "siwe" | "bandada"
}
