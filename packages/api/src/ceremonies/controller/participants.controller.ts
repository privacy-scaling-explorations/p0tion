import { Controller, Get, Request, Query, UseGuards } from "@nestjs/common"
import { ParticipantsService } from "../service/participants.service"
import { JWTGuard } from "src/auth/guard/jwt.guard"
import { CeremonyGuard } from "src/auth/guard/ceremony.guard"
import { JWTDto } from "src/auth/dto/auth-dto"

@Controller("participants")
export class ParticipantsController {
    constructor(private readonly participantsService: ParticipantsService) {}

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/resume-contribution-after-timeout-expiration")
    resumeContributionAfterTimeoutExpiration(
        @Query("ceremonyId") ceremonyId: number,
        @Request() { jwt }: { jwt: JWTDto }
    ) {
        return this.participantsService.resumeContributionAfterTimeoutExpiration(ceremonyId, jwt.user.id)
    }
}
