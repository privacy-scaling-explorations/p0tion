import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common"
import { CeremoniesService } from "../service/ceremonies.service"
import { CeremonyDto, CreateCircuitsDto } from "../dto/ceremony-dto"
import { CeremonyGuard } from "src/auth/guard/ceremony.guard"
import { JWTGuard } from "src/auth/guard/jwt.guard"

@Controller("ceremonies")
export class CeremoniesController {
    constructor(private readonly ceremoniesService: CeremoniesService) {}

    @Post("/create")
    create(@Body() ceremonyDto: CeremonyDto) {
        return this.ceremoniesService.create(ceremonyDto)
    }

    @Post("/create-circuits")
    createCircuits(@Query("ceremonyId") ceremonyId: number, @Body() createCircuitsDto: CreateCircuitsDto) {
        return this.ceremoniesService.createCircuits(ceremonyId, createCircuitsDto)
    }

    @Get("/find-by-id")
    findById(@Query("ceremonyId") ceremonyId: number) {
        return this.ceremoniesService.findById(ceremonyId)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/testing-ceremony")
    testingCeremony(@Query("ceremonyId") ceremonyId: number) {
        return {
            ceremonyId
        }
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/finalize-ceremony")
    finalizeCeremony(@Query("ceremonyId") ceremonyId: number) {
        return this.ceremoniesService.finalizeCeremony(ceremonyId)
    }
}
