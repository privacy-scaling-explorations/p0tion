import { validate } from "class-validator"
import { SiweDto } from "./siwe-dto"

describe("SiweDto", () => {
    it("should be defined", () => {
        expect(new SiweDto()).toBeDefined()
    })

    it("should pass validation with correct data", async () => {
        const dto = new SiweDto()
        dto.minimumNonce = 5
        dto.blockHeight = 1000000
        dto.chainName = "ethereum"

        const errors = await validate(dto)
        expect(errors.length).toBe(0)
    })

    it("should fail validation with incorrect data types", async () => {
        const dto = new SiweDto()
        ;(dto as any).minimumNonce = "not a number"
        ;(dto as any).blockHeight = "not a number"
        dto.chainName = 123 as any

        const errors = await validate(dto)
        expect(errors.length).toBe(3)
    })
})
