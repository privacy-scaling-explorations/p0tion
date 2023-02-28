import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import dotenv from "dotenv"
import { cwd } from "process"
import fs from "fs"
import { exportVerifierAndVKey, exportVerifierContract, exportVkey } from "../../src"
import { envType } from "../utils"
import { TestingEnvironment } from "../../src/types/enums"

chai.use(chaiAsPromised)
dotenv.config()

/**
 * Unit test for Verification utilities.
 */

describe("Verification utilities", () => {
    const finalZkeyPath = `${cwd()}/packages/actions/test/data/circuit-small_00001.zkey`
    const verifierExportPath = `${cwd()}/packages/actions/test/data/verifier.sol`
    const vKeyExportPath = `${cwd()}/packages/actions/test/data/vkey.json`
    const solidityVersion = "0.8.10"
    describe("exportVerifierContract", () => {
        if (envType === TestingEnvironment.PRODUCTION) {
            it("should export the verifier contract", async () => {
                await exportVerifierContract(solidityVersion, finalZkeyPath, verifierExportPath)
                expect(fs.existsSync(verifierExportPath)).to.be.true
            })
        }
        it("should fail when the zkey is not found", async () => {
            await expect(exportVerifierContract("0.8.0", "invalid-path", verifierExportPath)).to.be.rejected
        })
    })
    describe("exportVkey", () => {
        if (envType === TestingEnvironment.PRODUCTION) {
            it("should export the vkey", async () => {
                await exportVkey(finalZkeyPath, vKeyExportPath)
                expect(fs.existsSync(vKeyExportPath)).to.be.true
            })
        }
        it("should fail when the zkey is not found", async () => {
            await expect(exportVkey("invalid-path", vKeyExportPath)).to.be.rejected
        })
    })
    describe("exportVerifierAndVKey", () => {
        if (envType === TestingEnvironment.PRODUCTION) {
            it("should export the verifier contract and the vkey", async () => {
                await exportVerifierAndVKey("0.8.0", finalZkeyPath, verifierExportPath, vKeyExportPath)
                expect(fs.existsSync(verifierExportPath)).to.be.true
                expect(fs.existsSync(vKeyExportPath)).to.be.true
            })
        }
        it("should fail when the zkey is not found", async () => {
            await expect(exportVerifierAndVKey("0.8.0", "invalid-path", verifierExportPath, vKeyExportPath)).to.be
                .rejected
        })
    })
    afterAll(() => {
        if (fs.existsSync(verifierExportPath)) {
            fs.unlinkSync(verifierExportPath)
        }
        if (fs.existsSync(vKeyExportPath)) {
            fs.unlinkSync(vKeyExportPath)
        }
    })
})
