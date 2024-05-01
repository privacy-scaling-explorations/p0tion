import { Body, Controller, Get, Post, Query } from "@nestjs/common"
import { CeremoniesService } from "../service/ceremonies.service"
import { CreateCeremonyDto } from "../dto/create-ceremony-dto"

@Controller("ceremonies")
export class CeremoniesController {
    constructor(private readonly ceremoniesService: CeremoniesService) {}

    @Post("/create")
    create(@Body() createCeremonyDto: CreateCeremonyDto) {
        return this.ceremoniesService.create(createCeremonyDto)
    }

    @Get("/find-by-id")
    findById(@Query("id") id: number) {
        return this.ceremoniesService.findById(id)
    }
}
