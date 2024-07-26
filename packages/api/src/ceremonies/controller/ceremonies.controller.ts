import { Body, Controller, Get, Post, Query, Request, UseGuards } from "@nestjs/common"
import { CeremoniesService } from "../service/ceremonies.service"
import { CeremonyDto, CreateCircuitsDto } from "../dto/ceremony-dto"
import { CeremonyGuard } from "src/auth/guard/ceremony.guard"
import { JWTGuard } from "src/auth/guard/jwt.guard"
import { JWTDto } from "src/auth/dto/auth-dto"

@Controller("ceremonies")
export class CeremoniesController {
    constructor(private readonly ceremoniesService: CeremoniesService) {}

    @UseGuards(JWTGuard)
    @Post("/create")
    create(@Request() { jwt }: { jwt: JWTDto }, @Body() ceremonyDto: CeremonyDto) {
        ceremonyDto.coordinatorId = jwt.user.id
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

    @Get("/find-opened")
    findOpened() {
        return this.ceremoniesService.findOpened()
    }

    @Get("/find-closed")
    findClosed() {
        return this.ceremoniesService.findClosed()
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

    @UseGuards(JWTGuard)
    @Get("/is-coordinator")
    isCoordinator(@Request() { jwt }: { jwt: JWTDto }, @Query("ceremonyId") ceremonyId: number) {
        return this.ceremoniesService.isCoordinator(jwt.user.id, ceremonyId)
    }
}
