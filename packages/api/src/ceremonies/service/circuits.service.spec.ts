import { Test, TestingModule } from "@nestjs/testing"
import { CircuitsService } from "./circuits.service"

describe("CircuitsService", () => {
    let service: CircuitsService

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [CircuitsService]
        }).compile()

        service = module.get<CircuitsService>(CircuitsService)
    })

    it("should be defined", () => {
        expect(service).toBeDefined()
    })
})
