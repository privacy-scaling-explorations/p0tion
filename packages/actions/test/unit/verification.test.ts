import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword } from "firebase/auth"
import dotenv from "dotenv"
import { cwd } from "process"
import fs from "fs"
import {
    compareCeremonyArtifacts,
    createS3Bucket,
    exportVerifierAndVKey,
    exportVerifierContract,
    exportVkey,
    generateGROTH16Proof,
    getBucketName,
    verifyGROTH16Proof,
    verifyZKey
} from "../../src"
import {
    cleanUpMockCeremony,
    cleanUpMockUsers,
    createMockCeremony,
    createMockUser,
    deleteAdminApp,
    deleteBucket,
    deleteObjectFromS3,
    envType,
    generateUserPasswords,
    getStorageConfiguration,
    initializeAdminServices,
    initializeUserServices,
    sleep,
    uploadFileToS3
} from "../utils"
import { TestingEnvironment } from "../../src/types/enums"
import { fakeCeremoniesData, fakeCircuitsData, fakeUsersData } from "../data/samples"

chai.use(chaiAsPromised)
dotenv.config()

/**
 * Unit test for Verification utilities.
 */
describe("Verification utilities", () => {
    let wasmPath: string = ""
    let zkeyPath: string = ""
    let vkeyPath: string = ""

    if (envType === TestingEnvironment.DEVELOPMENT) {
        wasmPath = `${cwd()}/../actions/test/data/artifacts/circuit.wasm`
        zkeyPath = `${cwd()}/../actions/test/data/artifacts/circuit_0000.zkey`
        vkeyPath = `${cwd()}/../actions/test/data/artifacts/verification_key_circuit.json`
    } else {
        wasmPath = `${cwd()}/packages/actions/test/data/artifacts/circuit.wasm`
        zkeyPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_0000.zkey`
        vkeyPath = `${cwd()}/packages/actions/test/data/artifacts/verification_key_circuit.json`
    }

    const finalZkeyPath = `${cwd()}/packages/actions/test/data/artifacts/circuit-small_00001.zkey`
    const verifierExportPath = `${cwd()}/packages/actions/test/data/artifacts/verifier.sol`
    const vKeyExportPath = `${cwd()}/packages/actions/test/data/artifacts/vkey.json`
    const solidityVersion = "0.8.10"

    const { ceremonyBucketPostfix } = getStorageConfiguration()

    // Initialize admin and user services.
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp, userFunctions } = initializeUserServices()
    const userAuth = getAuth(userApp)

    const users = [fakeUsersData.fakeUser1]
    const passwords = generateUserPasswords(users.length)

    beforeAll(async () => {
        for (let i = 0; i < users.length; i++) {
            users[i].uid = await createMockUser(userApp, users[i].data.email, passwords[i], true, adminAuth)
        }
    })

    afterAll(async () => {
        await cleanUpMockUsers(adminAuth, adminFirestore, users)
        await deleteAdminApp()
    })

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
        let badzkeyPath: string = ""
        let wrongZkeyPath: string = ""
        let potPath: string = ""
        let r1csPath: string = ""

        if (envType === TestingEnvironment.DEVELOPMENT) {
            zkeyPath = `${cwd()}/../actions/test/data/artifacts/circuit_0000.zkey`
            badzkeyPath = `${cwd()}/../actions/test/data/artifacts/bad_circuit_0000.zkey`
            wrongZkeyPath = `${cwd()}/../actions/test/data/artifacts/notcircuit_0000.zkey`
            potPath = `${cwd()}/../actions/test/data/artifacts/powersOfTau28_hez_final_02.ptau`
            r1csPath = `${cwd()}/../actions/test/data/artifacts/circuit.r1cs`
        } else {
            zkeyPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_0000.zkey`
            badzkeyPath = `${cwd()}/packages/actions/test/data/artifacts/bad_circuit_0000.zkey`
            wrongZkeyPath = `${cwd()}/packages/actions/test/data/artifacts/notcircuit_0000.zkey`
            potPath = `${cwd()}/packages/actions/test/data/artifacts/powersOfTau28_hez_final_02.ptau`
            r1csPath = `${cwd()}/packages/actions/test/data/artifacts/circuit.r1cs`
        }

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
    if (envType === TestingEnvironment.PRODUCTION) {
        describe("compareCeremonyArtifacts", () => {
            const ceremony = fakeCeremoniesData.fakeCeremonyOpenedDynamic
            const bucketName = getBucketName(ceremony.data.prefix!, ceremonyBucketPostfix)
            const storagePath1 = "zkey1.zkey"
            const storagePath2 = "zkey2.zkey"
            const storagePath3 = "wasm.wasm"
            const localPath1 = `${cwd()}/packages/actions/test/data/artifacts/zkey1.zkey`
            const localPath2 = `${cwd()}/packages/actions/test/data/artifacts/zkey2.zkey`
            const localPath3 = `${cwd()}/packages/actions/test/data/artifacts/wasm.wasm`
            beforeAll(async () => {
                // sign in as coordinator
                await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
                // create mock ceremony
                await createMockCeremony(adminFirestore, ceremony, fakeCircuitsData.fakeCircuitSmallNoContributors)
                // create ceremony bucket
                await createS3Bucket(userFunctions, bucketName)
                await sleep(1000)
                // need to upload files to S3
                await uploadFileToS3(bucketName, storagePath1, zkeyPath)
                await uploadFileToS3(bucketName, storagePath2, zkeyPath)
                await uploadFileToS3(bucketName, storagePath3, wasmPath)
            })
            it("should return true when two artifacts are the same", async () => {
                expect(
                    await compareCeremonyArtifacts(
                        userFunctions,
                        localPath1,
                        localPath2,
                        storagePath1,
                        storagePath2,
                        bucketName,
                        bucketName,
                        true
                    )
                ).to.be.true
            })
            it("should return false when two artifacts are not the same", async () => {
                expect(
                    await compareCeremonyArtifacts(
                        userFunctions,
                        localPath1,
                        localPath3,
                        storagePath1,
                        storagePath3,
                        bucketName,
                        bucketName,
                        true
                    )
                ).to.be.false
            })
            afterAll(async () => {
                await deleteObjectFromS3(bucketName, storagePath1)
                await deleteObjectFromS3(bucketName, storagePath2)
                await deleteObjectFromS3(bucketName, storagePath3)
                await deleteBucket(bucketName)

                if (fs.existsSync(localPath1)) fs.unlinkSync(localPath1)
                if (fs.existsSync(localPath2)) fs.unlinkSync(localPath2)
                if (fs.existsSync(localPath3)) fs.unlinkSync(localPath3)

                await cleanUpMockCeremony(
                    adminFirestore,
                    ceremony.uid,
                    fakeCircuitsData.fakeCircuitSmallNoContributors.uid
                )
            })
        })
    }
    afterAll(() => {
        if (fs.existsSync(verifierExportPath)) {
            fs.unlinkSync(verifierExportPath)
        }
        if (fs.existsSync(vKeyExportPath)) {
            fs.unlinkSync(vKeyExportPath)
        }
    })
})
