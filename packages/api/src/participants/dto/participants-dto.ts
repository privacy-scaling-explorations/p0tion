import { IsNumber, IsString } from "class-validator"

export class ParticipantsDto {}

export class PermanentlyStoreCurrentContributionTimeAndHash {
    @IsNumber()
    contributionComputationTime: number

    @IsString()
    contributionHash: string
}
