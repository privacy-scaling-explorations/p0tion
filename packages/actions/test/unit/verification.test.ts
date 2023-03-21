import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword } from "firebase/auth"
import dotenv from "dotenv"
import { cwd } from "process"
import fs from "fs"
import {
    compareCeremonyArtifacts,
    createS3Bucket,
    downloadAllCeremonyArtifacts,
    exportVerifierAndVKey,
    exportVerifierContract,
    exportVkey,
    generateGROTH16Proof,
    generateZkeyFromScratch,
    getBucketName,
    getPotStorageFilePath,
    getR1csStorageFilePath,
    getZkeyStorageFilePath,
    verifyGROTH16Proof,
    verifyZKey,
    solidityVersion
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
import { generateFakeCircuit } from "../data/generators"

chai.use(chaiAsPromised)
dotenv.config()

/**
 * Unit test for Verification utilities.
 */
describe("Verification utilities", () => {
    // the data that was used to finalize the testing final zKey
    const finalizationBeacon = "1234567890"
    const finalizationCoordinatorId = "final"

    let wasmPath: string = ""
    let zkeyPath: string = ""
    let badzkeyPath: string = ""
    let wrongZkeyPath: string = ""
    let verificationKeyPath: string = ""
    let r1csPath: string = ""
    let potPath: string = ""
    let zkeyOutputPath: string = ""
    let zkeyFinalContributionPath: string = ""
    let finalZkeyPath: string = ""
    let verifierExportPath: string = ""
    let vKeyExportPath: string = ""
    let invalidVKey: string = ""
    let verifierTemplatePath: string = ""
    let outputDirectory: string = ""

    if (envType === TestingEnvironment.DEVELOPMENT) {
        wasmPath = `${cwd()}/../actions/test/data/artifacts/circuit.wasm`
        zkeyPath = `${cwd()}/../actions/test/data/artifacts/circuit_0000.zkey`
        badzkeyPath = `${cwd()}/../actions/test/data/artifacts/bad_circuit_0000.zkey`
        wrongZkeyPath = `${cwd()}/../actions/test/data/artifacts/notcircuit_0000.zkey`
        verificationKeyPath = `${cwd()}/../actions/test/data/artifacts/circuit_vkey.json`
        potPath = `${cwd()}/../actions/test/data/artifacts/powersOfTau28_hez_final_02.ptau`
        zkeyOutputPath = `${cwd()}/../actions/test/data/artifacts/circuit_verification.zkey`
        zkeyFinalContributionPath = `${cwd()}/../actions/test/data/artifacts/circuit_0001.zkey`
        finalZkeyPath = `${cwd()}/../actions/test/data/artifacts/circuit_final.zkey`
        verifierExportPath = `${cwd()}/../actions/test/data/artifacts/verifier.sol`
        vKeyExportPath = `${cwd()}/../actions/test/data/artifacts/vkey.json`
        r1csPath = `${cwd()}/../actions/test/data/artifacts/circuit.r1cs`
        potPath = `${cwd()}/../actions/test/data/artifacts/powersOfTau28_hez_final_02.ptau`
        badzkeyPath = `${cwd()}/../actions/test/data/artifacts/bad_circuit_0000.zkey`
        wrongZkeyPath = `${cwd()}/../actions/test/data/artifacts/notcircuit_0000.zkey`
        invalidVKey = `${cwd()}/../actions/test/data/artifacts/invalid_verification_key.json`
        verifierTemplatePath = `${cwd()}/../../node_modules/snarkjs/templates/verifier_groth16.sol.ejs`
        outputDirectory = `${cwd()}/../actions/test/data/artifacts/verification`
    } else {
        wasmPath = `${cwd()}/packages/actions/test/data/artifacts/circuit.wasm`
        zkeyPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_0000.zkey`
        badzkeyPath = `${cwd()}/packages/actions/test/data/artifacts/bad_circuit_0000.zkey`
        wrongZkeyPath = `${cwd()}/packages/actions/test/data/artifacts/notcircuit_0000.zkey`
        verificationKeyPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_vkey.json`
        potPath = `${cwd()}/packages/actions/test/data/artifacts/powersOfTau28_hez_final_02.ptau`
        zkeyOutputPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_verification.zkey`
        zkeyFinalContributionPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_0001.zkey`
        finalZkeyPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_final.zkey`
        verifierExportPath = `${cwd()}/packages/actions/test/data/artifacts/verifier.sol`
        vKeyExportPath = `${cwd()}/packages/actions/test/data/artifacts/vkey.json`
        r1csPath = `${cwd()}/packages/actions/test/data/artifacts/circuit.r1cs`
        potPath = `${cwd()}/packages/actions/test/data/artifacts/powersOfTau28_hez_final_02.ptau`
        badzkeyPath = `${cwd()}/packages/actions/test/data/artifacts/bad_circuit_0000.zkey`
        wrongZkeyPath = `${cwd()}/packages/actions/test/data/artifacts/notcircuit_0000.zkey`
        invalidVKey = `${cwd()}/packages/actions/test/data/artifacts/invalid_verification_key.json`
        verifierTemplatePath = `${cwd()}/node_modules/snarkjs/templates/verifier_groth16.sol.ejs`
        outputDirectory = `${cwd()}/packages/actions/test/data/artifacts/verification`
    }

    const { ceremonyBucketPostfix } = getStorageConfiguration()

    // Initialize admin and user services.
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp, userFirestore, userFunctions } = initializeUserServices()
    const userAuth = getAuth(userApp)

    const users = [fakeUsersData.fakeUser1]
    const passwords = generateUserPasswords(users.length)

    beforeAll(async () => {
        for (let i = 0; i < users.length; i++) {
            users[i].uid = await createMockUser(userApp, users[i].data.email, passwords[i], true, adminAuth)
        }
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
            const { proof, publicSignals } = await generateGROTH16Proof(inputs, finalZkeyPath, wasmPath)
            expect(proof).to.not.be.undefined

            // verify
            const success = await verifyGROTH16Proof(verificationKeyPath, publicSignals, proof)
            expect(success).to.be.true
        })
        it("should fail when given an invalid vkey", async () => {
            // verify
            await expect(verifyGROTH16Proof(invalidVKey, ["3", "4"], {})).to.be.rejected
        })
    })
    describe("exportVerifierContract", () => {
        if (envType === TestingEnvironment.PRODUCTION) {
            it("should export the verifier contract", async () => {
                const solidityCode = await exportVerifierContract(solidityVersion, finalZkeyPath, verifierTemplatePath)
                expect(solidityCode).to.not.be.undefined
            })
        }
        it("should fail when the zkey is not found", async () => {
            await expect(exportVerifierContract("0.8.0", "invalid-path", verifierTemplatePath)).to.be.rejected
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
                    verifierTemplatePath
                )
                expect(fs.existsSync(verifierExportPath)).to.be.true
                expect(fs.existsSync(vKeyExportPath)).to.be.true
            })
        }
        it("should fail when the zkey is not found", async () => {
            await expect(
                exportVerifierAndVKey("0.8.0", "invalid-path", verifierExportPath, vKeyExportPath, verifierTemplatePath)
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
                finalizationCoordinatorId,
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
                    finalizationCoordinatorId,
                    finalizationBeacon
                )
            ).to.be.rejectedWith(
                "There was an error while opening the last zKey generated by a contributor. Please make sure that you provided the right path and try again."
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

        describe("downloadAllCeremonyArtifacts", () => {
            const ceremony = fakeCeremoniesData.fakeCeremonyOpenedFixed

            // create a circuit object that suits our needs
            const circuits = generateFakeCircuit({
                uid: "000000000000000000A3",
                data: {
                    name: "Circuit",
                    description: "Short description of Circuit",
                    prefix: "circuit",
                    sequencePosition: 1,
                    fixedTimeWindow: 10,
                    zKeySizeInBytes: 45020,
                    lastUpdated: Date.now(),
                    metadata: {
                        constraints: 65,
                        curve: "bn-128",
                        labels: 79,
                        outputs: 1,
                        pot: 2,
                        privateInputs: 0,
                        publicInputs: 2,
                        wires: 67
                    },
                    template: {
                        commitHash: "295d995802b152a1dc73b5d0690ce3f8ca5d9b23",
                        paramsConfiguration: ["2"],
                        source: "https://github.com/0xjei/circom-starter/blob/dev/circuits/exercise/checkAscendingOrder.circom"
                    },
                    waitingQueue: {
                        completedContributions: 1,
                        contributors: [fakeUsersData.fakeUser1.uid, fakeUsersData.fakeUser2.uid],
                        currentContributor: fakeUsersData.fakeUser1.uid,
                        failedContributions: 0
                    },
                    files: {
                        initialZkeyBlake2bHash:
                            "eea0a468524a984908bff6de1de09867ac5d5b0caed92c3332fd5ec61004f79505a784df9d23f69f33efbfef016ad3138871fa8ad63b6e8124a9d0721b0e9e32",
                        initialZkeyFilename: "circuit_00000.zkey",
                        initialZkeyStoragePath: "circuits/circuit/contributions/circuit_00000.zkey",
                        potBlake2bHash:
                            "34379653611c22a7647da22893c606f9840b38d1cb6da3368df85c2e0b709cfdb03a8efe91ce621a424a39fe4d5f5451266d91d21203148c2d7d61cf5298d119",
                        potFilename: "powersOfTau28_hez_final_02.ptau",
                        potStoragePath: "pot/powersOfTau28_hez_final_02.ptau",
                        r1csBlake2bHash:
                            "0739198d5578a4bdaeb2fa2a1043a1d9cac988472f97337a0a60c296052b82d6cecb6ae7ce503ab9864bc86a38cdb583f2d33877c41543cbf19049510bca7472",
                        r1csFilename: "circuit.r1cs",
                        r1csStoragePath: "circuits/circuit/circuit.r1cs",
                        wasmBlake2bHash:
                            "00d09469acaba682802bf92df24708cf3d499b759379f959c4b6932b14fe9e6bfccc793c3933eac4a76546171d402cab1ae3ce1b3291dbba8e2fb358d52bd77d",
                        wasmFilename: "circuit.wasm",
                        wasmStoragePath: "circuits/circuit/circuit.wasm"
                    },
                    avgTimings: {
                        contributionComputation: 0,
                        fullContribution: 0,
                        verifyCloudFunction: 0
                    },
                    compiler: {
                        commitHash: "ed807764a17ce06d8307cd611ab6b917247914f5",
                        version: "2.0.5"
                    }
                }
            })

            const bucketName = getBucketName(ceremony.data.prefix!, ceremonyBucketPostfix)

            // the r1cs
            const r1csStorageFilePath = getR1csStorageFilePath(circuits.data.prefix!, "circuit.r1cs")
            // the last zkey
            const zkeyStorageFilePath = getZkeyStorageFilePath(circuits.data.prefix!, "circuit_00000.zkey")
            // the final zkey
            const finalZkeyStorageFilePath = getZkeyStorageFilePath(circuits.data.prefix!, `circuit_final.zkey`)
            // the pot
            const potStorageFilePath = getPotStorageFilePath("powersOfTau28_hez_final_02.ptau")

            beforeAll(async () => {
                await createMockCeremony(adminFirestore, ceremony, circuits)
                await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
                await createS3Bucket(userFunctions, bucketName)
                await sleep(1000)
                // upload all files to S3
                await uploadFileToS3(bucketName, r1csStorageFilePath, r1csPath)
                await uploadFileToS3(bucketName, zkeyStorageFilePath, zkeyPath)
                await uploadFileToS3(bucketName, finalZkeyStorageFilePath, finalZkeyPath)
                await uploadFileToS3(bucketName, potStorageFilePath, potPath)
            })
            it("should download all artifacts for a ceremony", async () => {
                await downloadAllCeremonyArtifacts(userFunctions, userFirestore, ceremony.data.prefix!, outputDirectory)
            })
            it("should fail to download all artifacts for a ceremony that does not exist", async () => {
                await expect(
                    downloadAllCeremonyArtifacts(userFunctions, userFirestore, "invalid", outputDirectory)
                ).to.be.rejectedWith("Ceremony not found. Please review your ceremony prefix and try again.")
            })
            afterAll(async () => {
                await cleanUpMockCeremony(adminFirestore, ceremony.uid, circuits.uid)
                await deleteObjectFromS3(bucketName, r1csStorageFilePath)
                await deleteObjectFromS3(bucketName, zkeyStorageFilePath)
                await deleteObjectFromS3(bucketName, finalZkeyStorageFilePath)
                await deleteObjectFromS3(bucketName, potStorageFilePath)
                await deleteBucket(bucketName)
                // remove dir with output
                if (fs.existsSync(outputDirectory)) fs.rmSync(outputDirectory, { recursive: true, force: true })
            })
        })
    }

    afterAll(async () => {
        if (fs.existsSync(verifierExportPath)) {
            fs.unlinkSync(verifierExportPath)
        }
        if (fs.existsSync(vKeyExportPath)) {
            fs.unlinkSync(vKeyExportPath)
        }
        await cleanUpMockUsers(adminAuth, adminFirestore, users)
        await deleteAdminApp()
    })
})
