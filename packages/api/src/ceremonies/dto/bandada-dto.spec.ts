import { validate } from "class-validator"
import { BandadaDto } from "./bandada-dto"

describe("BandadaDto", () => {
    it("should be defined", () => {
        expect(new BandadaDto()).toBeDefined()
    })

    it("should pass validation with correct data", async () => {
        const dto = new BandadaDto()
        dto.groupId = "test-group-id"

        const errors = await validate(dto)
        expect(errors.length).toBe(0)
    })

    it("should fail validation without groupId", async () => {
        const dto = new BandadaDto()
        const errors = await validate(dto)
        expect(errors.length).toBeGreaterThan(0)
    })
})
