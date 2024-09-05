import { Body, Controller, Get, Post, Put, Query, Request, UseGuards } from "@nestjs/common"
import { CeremoniesService } from "../service/ceremonies.service"
import { CeremonyDto, CreateCircuitsDto } from "../dto/ceremony-dto"
import { CeremonyGuard } from "src/auth/guard/ceremony.guard"
import { JWTGuard } from "src/auth/guard/jwt.guard"
import { JWTDto } from "src/auth/dto/auth-dto"
import { CoordinatorGuard } from "src/auth/guard/coordinator.guard"

@Controller("ceremonies")
export class CeremoniesController {
    constructor(private readonly ceremoniesService: CeremoniesService) {}

    @UseGuards(JWTGuard)
    @Post("/create")
    create(@Request() { jwt }: { jwt: JWTDto }, @Body() ceremonyDto: CeremonyDto) {
        ceremonyDto.coordinatorId = jwt.user.id
        return this.ceremoniesService.create(ceremonyDto)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(CoordinatorGuard)
    @UseGuards(JWTGuard)
    @Put("/update")
    update(
        @Request() { jwt }: { jwt: JWTDto },
        @Query("ceremonyId") ceremonyId: number,
        @Body() data: Partial<CeremonyDto>
    ) {
        return this.ceremoniesService.update(ceremonyId, jwt.user.id, data)
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

    @Get("/find-all")
    findAll() {
        return this.ceremoniesService.findAll()
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(CoordinatorGuard)
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
