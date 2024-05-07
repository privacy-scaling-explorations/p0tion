import { Body, Controller, Get, Post, Query } from "@nestjs/common"
import { CeremoniesService } from "../service/ceremonies.service"
import { CeremonyDto } from "../dto/ceremony-dto"

@Controller("ceremonies")
export class CeremoniesController {
    constructor(private readonly ceremoniesService: CeremoniesService) {}

    @Post("/create")
    create(@Body() ceremonyDto: CeremonyDto) {
        return this.ceremoniesService.create(ceremonyDto)
    }

    @Get("/find-by-id")
    findById(@Query("id") id: number) {
        return this.ceremoniesService.findById(id)
    }
}
