import { Test, TestingModule } from "@nestjs/testing"
import { ParticipantsController } from "./participants.controller"

describe("ParticipantsController", () => {
    let controller: ParticipantsController

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ParticipantsController]
        }).compile()

        controller = module.get<ParticipantsController>(ParticipantsController)
    })

    it("should be defined", () => {
        expect(controller).toBeDefined()
    })
})
