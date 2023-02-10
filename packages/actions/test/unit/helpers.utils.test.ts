import { expect } from "chai"
import { fakeCircuitsData } from "../data/samples"
import { extractPoTFromFilename, extractPrefix, formatZkeyIndex } from "../../src"

describe.skip("Utils", () => {
    describe("extractPoTFromFilename", () => {
        it("should extract the powers from pot file name", () => {
            expect(extractPoTFromFilename("powersOfTau28_hez_final_26.ptau")).to.equal(26)
        })
        it("should return NaN if the pot file name is invalid", () => {
            expect(extractPoTFromFilename("powersOfTau28_hez_final.ptau")).to.be.NaN
        })
    })
    describe("extractPrefix", () => {
        it("should return the prefix of a string", () => {
            expect(extractPrefix(fakeCircuitsData.fakeCircuitSmallNoContributors.data.name!)).to.equal(
                fakeCircuitsData.fakeCircuitSmallNoContributors.data.prefix
            )
        })
        it("should return the same string if it doesn't contain a dash", () => {
            expect(extractPrefix("test")).to.equal("test")
        })
    })
    describe("formatZkeyIndex", () => {
        it("should format the next zkey index", () => {
            expect(formatZkeyIndex(1)).to.equal("00001")
        })
        it("should work with different numbers", () => {
            for (let i = 1; i < 100; i++) {
                expect(formatZkeyIndex(i)).to.equal(i.toString().padStart(5, "0"))
            }
        })
    })
})
