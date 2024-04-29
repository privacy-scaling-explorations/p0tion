import { Test, TestingModule } from "@nestjs/testing"
import { CeremoniesService } from "./ceremonies.service"

describe("CeremoniesService", () => {
    let service: CeremoniesService

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [CeremoniesService]
        }).compile()

        service = module.get<CeremoniesService>(CeremoniesService)
    })

    it("should be defined", () => {
        expect(service).toBeDefined()
    })
})
