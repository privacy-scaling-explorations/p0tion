import { expect } from "chai"
import { cwd } from "process"
import { fakeCircuitsData } from "../data/samples"
import {
    extractPoTFromFilename,
    extractPrefix,
    formatZkeyIndex,
    getR1CSInfo,
    computeSmallestPowersOfTauForCircuit
} from "../../src"
import { envType } from "../utils"
import { TestingEnvironment } from "../../src/types/enums"

describe("Utils", () => {
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
    describe("getR1CSInfo", () => {
        const validR1CSFilePath =
            envType === TestingEnvironment.DEVELOPMENT
                ? `${cwd()}/../actions/test/data/artifacts/circuit.r1cs`
                : `${cwd()}/packages/actions/test/data/artifacts/circuit.r1cs`
        const invalidR1CSFilePath =
            envType === TestingEnvironment.DEVELOPMENT
                ? `${cwd()}/../actions/test/data/artifacts/circuit.circom`
                : `${cwd()}/packages/actions/test/data/artifacts/circuit.circom`

        it("should return the R1CS file info", () => {
            const r1csInfo = getR1CSInfo(validR1CSFilePath)

            expect(r1csInfo.curve).to.be.equal("bn-128")
            expect(r1csInfo.constraints).to.be.equal(1)
            expect(r1csInfo.labels).to.be.equal(8)
            expect(r1csInfo.outputs).to.be.equal(1)
            expect(r1csInfo.pot).to.be.equal(
                computeSmallestPowersOfTauForCircuit(r1csInfo.constraints, r1csInfo.outputs)
            )
            expect(r1csInfo.privateInputs).to.be.equal(3)
            expect(r1csInfo.publicInputs).to.be.equal(1)
            expect(r1csInfo.wires).to.be.equal(6)
        })

        it("should return an error if the R1CS is not valid", () => {
            expect(() => getR1CSInfo(invalidR1CSFilePath)).to.throw(
                "The R1CS file you provided would not appear to be correct. Please, check that you have provided a valid R1CS file and repeat the process."
            )
        })
    })
})
