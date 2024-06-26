import { Body, Controller, Get, Post, Query, Request, UseGuards } from "@nestjs/common"
import { CircuitsService } from "../service/circuits.service"
import { JWTGuard } from "src/auth/guard/jwt.guard"
import { CeremonyGuard } from "src/auth/guard/ceremony.guard"
import { JWTDto } from "src/auth/dto/auth-dto"
import { FinalizeCircuitData } from "../dto/circuits-dto"
import { VerifyContributionData } from "../dto/contribution-dto"

@Controller("circuits")
export class CircuitsController {
    constructor(private readonly circuitsService: CircuitsService) {}

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Post("/finalize-circuit")
    finalizeCircuit(
        @Query("ceremonyId") ceremonyId: number,
        @Request() { jwt }: { jwt: JWTDto },
        @Body() data: FinalizeCircuitData
    ) {
        return this.circuitsService.finalizeCircuit(ceremonyId, jwt.user.id, data)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Post("/verify-contribution")
    verifyContribution(
        @Query("ceremonyId") ceremonyId: number,
        @Request() { jwt }: { jwt: JWTDto },
        @Body() data: VerifyContributionData
    ) {
        return this.circuitsService.verifyContribution(ceremonyId, jwt.user.id, data)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/get-circuit-contributions-from-participant")
    getCircuitContributionsFromParticipant(
        @Query("ceremonyId") ceremonyId: number,
        @Query("circuitId") circuitId: number,
        @Request() { jwt }: { jwt: JWTDto }
    ) {
        return this.circuitsService.getCircuitContributionsFromParticipant(ceremonyId, circuitId, jwt.user.id)
    }
}
