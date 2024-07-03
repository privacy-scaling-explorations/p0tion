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
        @Query("participantId") participantId: string
    ) {
        return this.circuitsService.getCircuitContributionsFromParticipant(ceremonyId, circuitId, participantId)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/get-all-by-ceremony-id")
    async getByCeremonyId(@Query("ceremonyId") ceremonyId: number) {
        const circuits = await this.circuitsService.getCircuitsOfCeremony(ceremonyId)
        return { circuits }
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/get-circuit-by-id")
    getCircuitById(@Query("ceremonyId") ceremonyId: number, @Query("circuitId") circuitId: number) {
        return this.circuitsService.getCircuitById(ceremonyId, circuitId)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/get-contribution-by-id")
    getContributionById(
        @Query("ceremonyId") ceremonyId: number,
        @Query("circuitId") circuitId: number,
        @Query("contributionId") contributionId: number
    ) {
        return this.circuitsService.getContributionById(ceremonyId, circuitId, contributionId)
    }
}
