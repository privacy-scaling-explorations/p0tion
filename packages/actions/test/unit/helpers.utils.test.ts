import { expect } from "chai"
import { cwd } from "process"
import { fakeCircuitsData } from "../data/samples"
import {
    extractPoTFromFilename,
    extractPrefix,
    formatZkeyIndex,
    getR1CSInfo,
    computeSmallestPowersOfTauForCircuit,
    contribHashRegex
} from "../../src/index"
import { envType } from "../utils/index"
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
    describe("", () => {
        const hashStr = "Contribution Hash: \n" +
        "\t\t847482b6 5d88b59f 0e860287 8d527446 \n" +
        "\t\tf2fe25f6 ba2eb6d8 7478803e b723dd39 \n" +
        "\t\tdf0fa90a 4d8b0ee8 07d70070 03308fb4 \n" +
        "\t\t17c8ff20 0123b155 9aa15a5c 14b5bf26"
        const hash = "Contribution Hash: 847482b6 5d88b59f 0e860287 8d527446 " +
            "f2fe25f6 ba2eb6d8 7478803e b723dd39 " +
            "df0fa90a 4d8b0ee8 07d70070 03308fb4 " +
            "17c8ff20 0123b155 9aa15a5c 14b5bf26"

        it("should match unix contribution hash", () => {
            const hashStrUnix = hashStr + '\n'
            //const r = new RegExp("Contribution Hash: \n\t\t.+\n.+\n.+\n.+\n")    
            const match = hashStrUnix.match(contribHashRegex)
            expect(match).not.to.be.null
            
            expect(match?.length).to.be.greaterThan(0)

            const contributionHash = match?.at(0)?.replaceAll("\n\t\t", "")!
            expect(contributionHash).to.equal(hash + "\n")
        })
        it("should match Windows contribution hash", () => {
            const hashStrWin = hashStr + "\r\n" 
            const match = hashStrWin.match(contribHashRegex)
            expect(match).not.to.be.null
            expect(match?.length).to.be.greaterThan(0)

            const contributionHash = match?.at(0)?.replaceAll("\n\t\t", "")!
            expect(contributionHash).to.equal(hash + "\r\n")
        })
    })
})
