import { expect } from "chai"
import { parseCeremonyFile } from "../../src"

describe("non interactive setup", () => {
    it("return the parsed object", () => {})
    it("should throw when given an invalid path", () => {
        expect(() => parseCeremonyFile("invalid path")).to.throw
    })

    it("should throw when given an invalid timeout type", () => {})
    it("should throw when given invalid circuit data", () => {})
    it("should throw when given an invalid end date", () => {})
    it("should throw when given an invalid start date", () => {})
    it("should throw when given an invalid penalty", () => {})
})
