import { Test, TestingModule } from "@nestjs/testing"
import { CeremoniesController } from "./ceremonies.controller"

describe("CeremoniesController", () => {
    let controller: CeremoniesController

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [CeremoniesController]
        }).compile()

        controller = module.get<CeremoniesController>(CeremoniesController)
    })

    it("should be defined", () => {
        expect(controller).toBeDefined()
    })
})
