import { Body, Controller, Post, Query, Request, UseGuards } from "@nestjs/common"
import { CircuitsService } from "../service/circuits.service"
import { JWTGuard } from "src/auth/guard/jwt.guard"
import { CeremonyGuard } from "src/auth/guard/ceremony.guard"
import { JWTDto } from "src/auth/dto/auth-dto"
import { FinalizeCircuitData } from "../dto/circuits-dto"

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
}
