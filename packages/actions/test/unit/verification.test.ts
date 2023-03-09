import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import dotenv from "dotenv"
import { cwd } from "process"
import fs from "fs"
import {
    exportVerifierAndVKey,
    exportVerifierContract,
    exportVkey,
    generateGROTH16Proof,
    generateZkeyFromScratch,
    verifyGROTH16Proof,
    verifyZKey
} from "../../src"
import { envType } from "../utils"
import { TestingEnvironment } from "../../src/types/enums"
import { fakeUsersData } from "../data/samples"

chai.use(chaiAsPromised)
dotenv.config()

/**
 * Unit test for Verification utilities.
 */
describe("Verification utilities", () => {
    const finalizationBeacon = "1234567890"

    let wasmPath: string = ""
    let zkeyPath: string = ""
    let badzkeyPath: string = ""
    let wrongZkeyPath: string = ""
    let vkeyPath: string = ""
    let r1csPath: string = ""
    let potPath: string = ""
    let zkeyOutputPath: string = ""
    let zkeyFinalContributionPath: string = ""

    if (envType === TestingEnvironment.DEVELOPMENT) {
        wasmPath = `${cwd()}/../actions/test/data/artifacts/circuit.wasm`
        zkeyPath = `${cwd()}/../actions/test/data/artifacts/circuit_0000.zkey`
        badzkeyPath = `${cwd()}/../actions/test/data/artifacts/bad_circuit_0000.zkey`
        wrongZkeyPath = `${cwd()}/../actions/test/data/artifacts/notcircuit_0000.zkey`
        vkeyPath = `${cwd()}/../actions/test/data/artifacts/verification_key_circuit.json`
        r1csPath = `${cwd()}/../actions/test/data/artifacts/circuit.r1cs`
        potPath = `${cwd()}/../actions/test/data/artifacts/powersOfTau28_hez_final_02.ptau`
        zkeyOutputPath = `${cwd()}/../actions/test/data/artifacts/circuit_verification.zkey`
        zkeyFinalContributionPath = `${cwd()}/../actions/test/data/artifacts/circuit_0001.zkey`
    } else {
        wasmPath = `${cwd()}/packages/actions/test/data/artifacts/circuit.wasm`
        zkeyPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_0000.zkey`
        badzkeyPath = `${cwd()}/packages/actions/test/data/artifacts/bad_circuit_0000.zkey`
        wrongZkeyPath = `${cwd()}/packages/actions/test/data/artifacts/notcircuit_0000.zkey`
        vkeyPath = `${cwd()}/packages/actions/test/data/artifacts/verification_key_circuit.json`
        r1csPath = `${cwd()}/packages/actions/test/data/artifacts/circuit.r1cs`
        potPath = `${cwd()}/packages/actions/test/data/artifacts/powersOfTau28_hez_final_02.ptau`
        zkeyOutputPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_verification.zkey`
        zkeyFinalContributionPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_0001.zkey`
    }

    describe("generateGROTH16Proof", () => {
        it("should generate a GROTH16 proof", async () => {
            const inputs = {
                x1: "5",
                x2: "10",
                x3: "1",
                x4: "2"
            }
            const { proof } = await generateGROTH16Proof(inputs, zkeyPath, wasmPath)
            expect(proof).to.not.be.undefined
        })
        it("should fail to gnenerate a GROTH16 proof when given the wrong inputs", async () => {
            await expect(generateGROTH16Proof({}, zkeyPath, wasmPath)).to.be.rejectedWith(Error)
        })
        it("should fail to generate a GROTH16 proof when given the wrong zkey path", async () => {
            const inputs = {
                x1: "5",
                x2: "10",
                x3: "1",
                x4: "2"
            }
            await expect(generateGROTH16Proof(inputs, `${zkeyPath}1`, wasmPath)).to.be.rejectedWith(Error)
        })
    })
    describe("verifyGROTH16 Proof", () => {
        it("should return true for a valid proof", async () => {
            // generate
            const inputs = {
                x1: "13",
                x2: "7",
                x3: "4",
                x4: "2"
            }
            const { proof, publicSignals } = await generateGROTH16Proof(inputs, zkeyPath, wasmPath)
            expect(proof).to.not.be.undefined

            // verify
            const success = await verifyGROTH16Proof(vkeyPath, publicSignals, proof)
            expect(success).to.be.true
        })
        it("should fail when given an invalid vkey", async () => {
            // verify
            await expect(
                verifyGROTH16Proof(
                    `${cwd()}/packages/actions/test/data/artifacts/invalid_verification_key.json`,
                    ["3", "4"],
                    {}
                )
            ).to.be.rejected
        })
    })

    const finalZkeyPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_final.zkey`
    const verifierExportPath = `${cwd()}/packages/actions/test/data/artifacts/verifier.sol`
    const vKeyExportPath = `${cwd()}/packages/actions/test/data/artifacts/vkey.json`
    const solidityVersion = "0.8.10"

    describe("exportVerifierContract", () => {
        if (envType === TestingEnvironment.PRODUCTION) {
            it("should export the verifier contract", async () => {
                const solidityCode = await exportVerifierContract(
                    solidityVersion,
                    finalZkeyPath,
                    `${cwd()}/node_modules/snarkjs/templates/verifier_groth16.sol.ejs`
                )
                expect(solidityCode).to.not.be.undefined
            })
        }
        it("should fail when the zkey is not found", async () => {
            await expect(
                exportVerifierContract(
                    "0.8.0",
                    "invalid-path",
                    `${cwd()}/node_modules/snarkjs/templates/verifier_groth16.sol.ejs`
                )
            ).to.be.rejected
        })
    })
    describe("exportVkey", () => {
        if (envType === TestingEnvironment.PRODUCTION) {
            it("should export the vkey", async () => {
                const vKey = await exportVkey(finalZkeyPath)
                expect(vKey).to.not.be.undefined
            })
        }
        it("should fail when the zkey is not found", async () => {
            await expect(exportVkey("invalid-path")).to.be.rejected
        })
    })
    describe("exportVerifierAndVKey", () => {
        if (envType === TestingEnvironment.PRODUCTION) {
            it("should export the verifier contract and the vkey", async () => {
                await exportVerifierAndVKey(
                    "0.8.0",
                    finalZkeyPath,
                    verifierExportPath,
                    vKeyExportPath,
                    `${cwd()}/node_modules/snarkjs/templates/verifier_groth16.sol.ejs`
                )
                expect(fs.existsSync(verifierExportPath)).to.be.true
                expect(fs.existsSync(vKeyExportPath)).to.be.true
            })
        }
        it("should fail when the zkey is not found", async () => {
            await expect(
                exportVerifierAndVKey(
                    "0.8.0",
                    "invalid-path",
                    verifierExportPath,
                    vKeyExportPath,
                    `${cwd()}/node_modules/snarkjs/templates/verifier_groth16.sol.ejs`
                )
            ).to.be.rejected
        })
    })
    describe("verifyzKey", () => {
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
    describe("generateZKeyFromScratch", () => {
        // after each test clean up the generate zkey
        afterEach(() => {
            if (fs.existsSync(zkeyOutputPath)) fs.unlinkSync(zkeyOutputPath)
        })
        it("should generate a genesis zkey from scratch", async () => {
            await generateZkeyFromScratch(false, r1csPath, potPath, zkeyOutputPath, null)
            expect(fs.existsSync(zkeyPath)).to.be.true
        })
        it("should generate a final zkey from scratch", async () => {
            await generateZkeyFromScratch(
                true,
                r1csPath,
                potPath,
                zkeyOutputPath,
                null,
                zkeyFinalContributionPath,
                fakeUsersData.fakeUser1.uid,
                finalizationBeacon
            )
        })
        it("should throw when given a wrong path to one of the artifacts (genesis zkey)", async () => {
            await expect(
                generateZkeyFromScratch(false, "invalid-path", potPath, zkeyOutputPath, null)
            ).to.be.rejectedWith(
                "There was an error while opening the local files. Please make sure that you provided the right paths and try again."
            )
        })
        it("should throw when given a wrong path to one of the artifacts (final zkey)", async () => {
            await expect(
                generateZkeyFromScratch(
                    true,
                    r1csPath,
                    potPath,
                    zkeyOutputPath,
                    null,
                    "invalid-path",
                    fakeUsersData.fakeUser1.uid,
                    finalizationBeacon
                )
            ).to.be.rejectedWith(
                "There was an error while opening the last zKey generated by a contributor. Please make sure that you provided the right path and try again."
            )
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
