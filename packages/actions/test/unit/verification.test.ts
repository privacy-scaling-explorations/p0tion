import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { cwd } from "process"
import { verifyZKey } from "../../src"

chai.use(chaiAsPromised)

/**
 * Verification tests
 */
describe("Verification", () => {
    /// @note verify that a zKey is valid
    describe("verifyzKey", () => {
        const zkeyPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_0000.zkey`
        const badzkeyPath = `${cwd()}/packages/actions/test/data/artifacts/bad_circuit_0000.zkey`
        const wrongZkeyPath = `${cwd()}/packages/actions/test/data/artifacts/notcircuit_0000.zkey`
        const potPath = `${cwd()}/packages/actions/test/data/artifacts/powersOfTau28_hez_final_02.ptau`
        const r1csPath = `${cwd()}/packages/actions/test/data/artifacts/circuit.r1cs`
        it("should return true for a valid zkey", async () => {
            expect(await verifyZKey(r1csPath, zkeyPath, potPath)).to.be.true
        })
        it("should throw when given an invalid zkey", async () => {
            await expect(verifyZKey(r1csPath, badzkeyPath, potPath)).to.be.rejected
        })
        it("should return false when given a zkey for another circuit", async () => {
            expect(await verifyZKey(r1csPath, wrongZkeyPath, potPath)).to.be.false
        })
        it("should throw an error if the r1cs file is not found", async () => {
            await expect(verifyZKey("invalid", zkeyPath, potPath)).to.be.rejectedWith(
                Error,
                "R1CS file not found at invalid"
            )
        })
        it("should throw an error if the zkey file is not found", async () => {
            await expect(verifyZKey(r1csPath, "invalid", potPath)).to.be.rejectedWith(
                Error,
                "zKey file not found at invalid"
            )
        })
        it("should throw an error if the pot file is not found", async () => {
            await expect(verifyZKey(r1csPath, zkeyPath, "invalid")).to.be.rejectedWith(
                Error,
                "PoT file not found at invalid"
            )
        })
    })
})
