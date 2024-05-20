import { Module } from "@nestjs/common"
import { ParticipantsController } from "./controller/participants.controller"
import { ParticipantsService } from "./service/participants.service"

@Module({
    controllers: [ParticipantsController],
    providers: [ParticipantsService]
})
export class ParticipantsModule {}
