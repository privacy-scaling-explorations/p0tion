import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import dotenv from "dotenv"
import { cwd } from "process"
import { ethers } from "hardhat"
import { envType } from "../utils"
import { TestingEnvironment } from "../../src/types/enums"
import { generateGROTH16Proof, verifyGROTH16Proof, formatSolidityCalldata } from "../../src"

chai.use(chaiAsPromised)
dotenv.config()

/**
 * Unit test for Verification utilities.
 */

describe("contract", () => {
    if (envType === TestingEnvironment.PRODUCTION) {
        let contractFactory: any
        let mockVerifier: any
        let wasmPath: string = ""
        let zkeyPath: string = ""
        let vkeyPath: string = ""

        wasmPath = `${cwd()}/test/data/artifacts/circuit.wasm`
        zkeyPath = `${cwd()}/test/data/artifacts/circuit_final.zkey`
        vkeyPath = `${cwd()}/test/data/artifacts/circuit_vkey.json`

        before(async () => {
            contractFactory = await ethers.getContractFactory("Verifier")
            mockVerifier = await contractFactory.deploy()
        })

        describe("Deployment", () => {
            it("should deploy the contract", async () => {
                const factory = await ethers.getContractFactory("Verifier")
                const contract = await factory.deploy()
                expect(ethers.utils.isAddress(contract.address)).to.be.true
            })
        })
        describe("Proof verification", () => {
            it("should true true when provided with a valid SNARK proof", async () => {
                // gen proof locally
                const inputs = {
                    x1: "5",
                    x2: "10",
                    x3: "1",
                    x4: "2"
                }
                const { proof, publicSignals } = await generateGROTH16Proof(inputs, zkeyPath, wasmPath)
                // verify locally
                const success = await verifyGROTH16Proof(vkeyPath, publicSignals, proof)
                expect(success).to.be.true
                // verify on chain
                const calldata = formatSolidityCalldata(publicSignals, proof)
                const res = await mockVerifier.verifyProof(calldata.arg1, calldata.arg2, calldata.arg3, calldata.arg4)
                expect(res).to.be.true
            })
            it("should return false when provided with an invalid proof", async () => {
                const res = await mockVerifier.verifyProof(
                    [
                        "0x29d8481153908a645b2e083e81794b9fe132306a09fee9f33aa659ffe2d363a7",
                        "0x13c901b1b68e686af6cc79f2850c13098d6e20a2da82992614b233860bc5d250"
                    ],
                    [
                        [
                            "0x2ba7b8139b6dbe4cf4c37f304f769a8d0f9df1accceeebbfa0468927e1497383",
                            "0x1b250dc4deb1289eefe63494481c2e61c29718631209eccef4e3e0a2a54b2342"
                        ],
                        [
                            "0x1fc104df098282bd1c9c0e77ab786acf82ca5418c19c792ee067967e83869576",
                            "0x112432d1ed2bdea56271fec942a4e0dc45f27472d5d667379c64ce7091f47cc3"
                        ]
                    ],
                    [
                        "0x1bdc2af2a36081f2ba33f1379212fffef9dee1601190d85b87c51809bc9332df",
                        "0x1f867ab230c5100685c2a0f7236f08c08e4164d77255827409fd098cb5c5eba3"
                    ],
                    [
                        "0x0000000000000000000000000000000000000000000000000000000000000003",
                        "0x0000000000000000000000000000000000000000000000000000000000000006"
                    ]
                )
                expect(res).to.be.false
            })
        })
    }
})
