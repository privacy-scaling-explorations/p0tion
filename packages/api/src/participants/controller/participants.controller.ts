import { Controller, Get, Query, Request, UseGuards } from "@nestjs/common"
import { JWTDto } from "src/auth/dto/auth-dto"
import { ParticipantsService } from "../service/participants.service"
import { CeremonyGuard } from "src/auth/guard/ceremony.guard"
import { JWTGuard } from "src/auth/guard/jwt.guard"

@Controller("participants")
export class ParticipantsController {
    constructor(private readonly participantsService: ParticipantsService) {}

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/check-participant-for-ceremony")
    checkParticipantForCeremony(@Query("ceremonyId") ceremonyId: number, @Request() { jwt }: { jwt: JWTDto }) {
        return this.participantsService.checkParticipantForCeremony(ceremonyId, jwt.user.id)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/resume-contribution-after-timeout-expiration")
    resumeContributionAfterTimeoutExpiration(
        @Query("ceremonyId") ceremonyId: number,
        @Request() { jwt }: { jwt: JWTDto }
    ) {
        return this.participantsService.resumeContributionAfterTimeoutExpiration(ceremonyId, jwt.user.id)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/progress-to-next-circuit-for-contribution")
    progressToNextCircuitForContribution(@Query("ceremonyId") ceremonyId: number, @Request() { jwt }: { jwt: JWTDto }) {
        return this.participantsService.progressToNextCircuitForContribution(ceremonyId, jwt.user.id)
    }
}
