import { Controller, Post } from "@nestjs/common"
import { CeremoniesService } from "../service/ceremonies.service"

@Controller("ceremonies")
export class CeremoniesController {
    constructor(private readonly ceremoniesService: CeremoniesService) {}

    @Post("/create")
    create() {
        return this.ceremoniesService.create()
    }
}
