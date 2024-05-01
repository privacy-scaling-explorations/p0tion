import { CreateCeremonyDto } from "./create-ceremony-dto"

describe("CeremoniesDto", () => {
    it("should be defined", () => {
        expect(new CreateCeremonyDto()).toBeDefined()
    })
})
