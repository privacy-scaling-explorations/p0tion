import { validate } from "class-validator"
import { GithubDto } from "./github-dto"

describe("GithubDto", () => {
    it("should be defined", () => {
        expect(new GithubDto()).toBeDefined()
    })

    it("should pass validation with correct data", async () => {
        const dto = new GithubDto()
        dto.minimumFollowing = 5
        dto.minimumFollowers = 10
        dto.minimumPublicRepos = 3
        dto.minimumAge = 30

        const errors = await validate(dto)
        expect(errors.length).toBe(0)
    })

    it("should fail validation with non-numeric data", async () => {
        const dto = new GithubDto()
        ;(dto as any).minimumFollowing = "not a number"

        const errors = await validate(dto)
        expect(errors.length).toBeGreaterThan(0)
    })
})
