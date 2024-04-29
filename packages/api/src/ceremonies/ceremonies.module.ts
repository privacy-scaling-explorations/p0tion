import { Module } from "@nestjs/common"
import { CeremoniesController } from "./controller/ceremonies.controller"
import { CeremoniesService } from "./service/ceremonies.service"

@Module({
    controllers: [CeremoniesController],
    providers: [CeremoniesService]
})
export class CeremoniesModule {}
