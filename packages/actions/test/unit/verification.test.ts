import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword } from "firebase/auth"
import dotenv from "dotenv"
import { cwd } from "process"
import fs from "fs"
import { UserDocumentReferenceAndData } from "src/types"
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
    getVerificationKeyStorageFilePath,
    getVerifierContractStorageFilePath,
    getZkeyStorageFilePath,
    verificationKeyAcronym,
    verifierSmartContractAcronym,
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
    const finalizationBeacon = "1234567890"

    let wasmPath: string = ""
    let zkeyPath: string = ""
    let badzkeyPath: string = ""
    let wrongZkeyPath: string = ""
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
    let verifierPath: string = ""
    let verificationKeyPath: string = ""

    if (envType === TestingEnvironment.DEVELOPMENT) {
        wasmPath = `${cwd()}/../actions/test/data/artifacts/circuit.wasm`
        zkeyPath = `${cwd()}/../actions/test/data/artifacts/circuit_0000.zkey`
        badzkeyPath = `${cwd()}/../actions/test/data/artifacts/bad_circuit_0000.zkey`
        wrongZkeyPath = `${cwd()}/../actions/test/data/artifacts/notcircuit_0000.zkey`
        r1csPath = `${cwd()}/../actions/test/data/artifacts/circuit.r1cs`
        potPath = `${cwd()}/../actions/test/data/artifacts/powersOfTau28_hez_final_02.ptau`
        zkeyOutputPath = `${cwd()}/../actions/test/data/artifacts/circuit_verification.zkey`
        zkeyFinalContributionPath = `${cwd()}/../actions/test/data/artifacts/circuit_0001.zkey`
        finalZkeyPath = `${cwd()}/../actions/test/data/artifacts/circuit_final.zkey`
        verifierExportPath = `${cwd()}/../actions/test/data/artifacts/verifier.sol`
        vKeyExportPath = `${cwd()}/../actions/test/data/artifacts/vkey.json`
        invalidVKey = `${cwd()}/../actions/test/data/artifacts/invalid_verification_key.json`
        verifierTemplatePath = `${cwd()}/../../node_modules/snarkjs/templates/verifier_groth16.sol.ejs`
        outputDirectory = `${cwd()}/../actions/test/data/artifacts/verification`
        verifierPath = `${cwd()}/../actions/test/data/artifacts/circuit_verifier.sol`
        verificationKeyPath = `${cwd()}/../actions/test/data/artifacts/circuit_vkey.json`
    } else {
        wasmPath = `${cwd()}/packages/actions/test/data/artifacts/circuit.wasm`
        zkeyPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_0000.zkey`
        badzkeyPath = `${cwd()}/packages/actions/test/data/artifacts/bad_circuit_0000.zkey`
        wrongZkeyPath = `${cwd()}/packages/actions/test/data/artifacts/notcircuit_0000.zkey`
        r1csPath = `${cwd()}/packages/actions/test/data/artifacts/circuit.r1cs`
        potPath = `${cwd()}/packages/actions/test/data/artifacts/powersOfTau28_hez_final_02.ptau`
        zkeyOutputPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_verification.zkey`
        zkeyFinalContributionPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_0001.zkey`
        finalZkeyPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_final.zkey`
        verifierExportPath = `${cwd()}/packages/actions/test/data/artifacts/verifier.sol`
        vKeyExportPath = `${cwd()}/packages/actions/test/data/artifacts/vkey.json`
        invalidVKey = `${cwd()}/packages/actions/test/data/artifacts/invalid_verification_key.json`
        verifierTemplatePath = `${cwd()}/node_modules/snarkjs/templates/verifier_groth16.sol.ejs`
        outputDirectory = `${cwd()}/packages/actions/test/data/artifacts/verification`
        verifierPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_verifier.sol`
        verificationKeyPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_vkey.json`
    }

    const solidityVersion = "0.8.18"

    const { ceremonyBucketPostfix } = getStorageConfiguration()

    // Initialize admin and user services.
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp, userFirestore, userFunctions } = initializeUserServices()
    const userAuth = getAuth(userApp)

    const users: UserDocumentReferenceAndData[] = [fakeUsersData.fakeUser1]
    const passwords = generateUserPasswords(users.length)

    beforeAll(async () => {
        for (let i = 0; i < users.length; i++) {
            users[i].uid = await createMockUser(userApp, users[i].data.email, passwords[i], true, adminAuth)
        }
        await sleep(1000)
        await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
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
            await expect(exportVerifierContract(solidityVersion, "invalid-path", verifierTemplatePath)).to.be.rejected
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
                    solidityVersion,
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
                exportVerifierAndVKey(
                    solidityVersion,
                    "invalid-path",
                    verifierExportPath,
                    vKeyExportPath,
                    verifierTemplatePath
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

    if (envType === TestingEnvironment.PRODUCTION) {
        // this data is shared between other prod tests (download artifacts and verify ceremony)
        const ceremony = fakeCeremoniesData.fakeCeremonyOpenedFixed

        // create a circuit object that suits our needs
        const circuit = fakeCircuitsData.fakeCircuitForFinalization

        const bucketName = getBucketName(ceremony.data.prefix!, ceremonyBucketPostfix)

        // the r1cs
        const r1csStorageFilePath = getR1csStorageFilePath(circuit.data.prefix!, "circuit.r1cs")
        // the last zkey
        const zkeyStorageFilePath = getZkeyStorageFilePath(circuit.data.prefix!, "circuit_00000.zkey")
        // the final zkey
        const finalZkeyStorageFilePath = getZkeyStorageFilePath(circuit.data.prefix!, "circuit_final.zkey")
        // the pot
        const potStorageFilePath = getPotStorageFilePath("powersOfTau28_hez_final_02.ptau")
        // the verifier
        const verifierStorageFilePath = getVerifierContractStorageFilePath(
            circuit.data.prefix!,
            `${verifierSmartContractAcronym}.sol`
        )
        // the vKey
        const verificationKeyStoragePath = getVerificationKeyStorageFilePath(
            circuit.data.prefix!,
            `${verificationKeyAcronym}.json`
        )

        // pre conditions for the tests
        beforeAll(async () => {
            await createMockCeremony(adminFirestore, ceremony, circuit)
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await createS3Bucket(userFunctions, bucketName)
            await sleep(1000)
            // upload all files to S3
            await uploadFileToS3(bucketName, r1csStorageFilePath, r1csPath)
            await uploadFileToS3(bucketName, zkeyStorageFilePath, zkeyPath)
            await uploadFileToS3(bucketName, finalZkeyStorageFilePath, finalZkeyPath)
            await uploadFileToS3(bucketName, potStorageFilePath, potPath)
            await uploadFileToS3(bucketName, verifierStorageFilePath, verifierPath)
            await uploadFileToS3(bucketName, verificationKeyStoragePath, verificationKeyPath)
        })

        describe("compareCeremonyArtifacts", () => {
            const ceremonyOpened = fakeCeremoniesData.fakeCeremonyOpenedDynamic
            const bucketNameOpened = getBucketName(ceremonyOpened.data.prefix!, ceremonyBucketPostfix)
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
                await createMockCeremony(
                    adminFirestore,
                    ceremonyOpened,
                    fakeCircuitsData.fakeCircuitSmallNoContributors
                )
                // create ceremony bucket
                await createS3Bucket(userFunctions, bucketNameOpened)
                await sleep(1000)
                // need to upload files to S3
                await uploadFileToS3(bucketNameOpened, storagePath1, zkeyPath)
                await uploadFileToS3(bucketNameOpened, storagePath2, zkeyPath)
                await uploadFileToS3(bucketNameOpened, storagePath3, wasmPath)
            })
            it("should return true when two artifacts are the same", async () => {
                expect(
                    await compareCeremonyArtifacts(
                        userFunctions,
                        localPath1,
                        localPath2,
                        storagePath1,
                        storagePath2,
                        bucketNameOpened,
                        bucketNameOpened,
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
                        bucketNameOpened,
                        bucketNameOpened,
                        true
                    )
                ).to.be.false
            })
            afterAll(async () => {
                await deleteObjectFromS3(bucketNameOpened, storagePath1)
                await deleteObjectFromS3(bucketNameOpened, storagePath2)
                await deleteObjectFromS3(bucketNameOpened, storagePath3)
                await deleteBucket(bucketNameOpened)

                if (fs.existsSync(localPath1)) fs.unlinkSync(localPath1)
                if (fs.existsSync(localPath2)) fs.unlinkSync(localPath2)
                if (fs.existsSync(localPath3)) fs.unlinkSync(localPath3)

                await cleanUpMockCeremony(
                    adminFirestore,
                    ceremonyOpened.uid,
                    fakeCircuitsData.fakeCircuitSmallNoContributors.uid
                )
            })
        })

        describe("downloadAllCeremonyArtifacts", () => {
            it("should download all artifacts for a ceremony", async () => {
                await downloadAllCeremonyArtifacts(userFunctions, userFirestore, ceremony.data.prefix!, outputDirectory)
            })
            it("should fail to download all artifacts for a ceremony that does not exist", async () => {
                await expect(
                    downloadAllCeremonyArtifacts(userFunctions, userFirestore, "invalid", outputDirectory)
                ).to.be.rejectedWith("Ceremony not found. Please review your ceremony prefix and try again.")
            })
            afterAll(async () => {
                // remove dir with output
                if (fs.existsSync(outputDirectory)) fs.rmSync(outputDirectory, { recursive: true, force: true })
            })
        })

        // clean up
        afterAll(async () => {
            await cleanUpMockCeremony(adminFirestore, ceremony.uid, circuit.uid)
            await deleteObjectFromS3(bucketName, r1csStorageFilePath)
            await deleteObjectFromS3(bucketName, zkeyStorageFilePath)
            await deleteObjectFromS3(bucketName, finalZkeyStorageFilePath)
            await deleteObjectFromS3(bucketName, potStorageFilePath)
            await deleteObjectFromS3(bucketName, verifierStorageFilePath)
            await deleteObjectFromS3(bucketName, verificationKeyStoragePath)
            await deleteBucket(bucketName)
            // remove dir with output
            if (fs.existsSync(outputDirectory)) fs.rmSync(outputDirectory, { recursive: true, force: true })
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
