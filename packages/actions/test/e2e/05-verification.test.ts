import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import dotenv from "dotenv"
import { cwd } from "process"
import fs from "fs"
import { getAuth, signInWithEmailAndPassword } from "firebase/auth"
import { Signer } from "ethers"
import { ethers } from "hardhat"
import {
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
import {
    getBucketName,
    getR1csStorageFilePath,
    getZkeyStorageFilePath,
    getPotStorageFilePath,
    createS3Bucket,
    verifyCeremony
} from "../../src"
import { fakeCeremoniesData, fakeUsersData } from "../data/samples"
import { generateFakeCircuit } from "../data/generators"
import { UserDocumentReferenceAndData } from "../../src/types"

chai.use(chaiAsPromised)
dotenv.config()

/**
 * Unit test for Verification utilities.
 */

describe("Verify a ceremony integrity", () => {
    let signer: Signer
    if (envType === TestingEnvironment.PRODUCTION) {
        const wasmPath = `${cwd()}/test/data/artifacts/circuit.wasm`
        const zkeyPath = `${cwd()}/test/data/artifacts/circuit_0000.zkey`
        const r1csPath = `${cwd()}/test/data/artifacts/circuit.r1cs`
        const potPath = `${cwd()}/test/data/artifacts/powersOfTau28_hez_final_02.ptau`
        const finalZkeyPath = `${cwd()}/test/data/artifacts/circuit_final.zkey`
        const outputDirectory = `${cwd()}/test/data/artifacts/verification`
        const verifierTemplatePath = `${cwd()}/../../node_modules/snarkjs/templates/verifier_groth16.sol.ejs`

        // this data is shared between other prod tests (download artifacts and verify ceremony)
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
                    r1csStoragePath: "circuits/circuit/circuit.r1cs"
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

        const { ceremonyBucketPostfix } = getStorageConfiguration()

        const bucketName = getBucketName(ceremony.data.prefix!, ceremonyBucketPostfix)

        // the r1cs
        const r1csStorageFilePath = getR1csStorageFilePath(circuits.data.prefix!, "circuit.r1cs")
        // the last zkey
        const zkeyStorageFilePath = getZkeyStorageFilePath(circuits.data.prefix!, "circuit_00001.zkey")
        // the final zkey
        const finalZkeyStorageFilePath = getZkeyStorageFilePath(circuits.data.prefix!, "circuit_final.zkey")
        // the pot
        const potStorageFilePath = getPotStorageFilePath("powersOfTau28_hez_final_02.ptau")
        const solidityVersion = "0.8.18"

        // Initialize admin and user services.
        const { adminFirestore, adminAuth } = initializeAdminServices()
        const { userApp, userFirestore, userFunctions } = initializeUserServices()
        const userAuth = getAuth(userApp)

        const users: UserDocumentReferenceAndData[] = [fakeUsersData.fakeUser1]
        const passwords = generateUserPasswords(users.length)

        before(async () => {
            ;[signer] = await ethers.getSigners()

            for (let i = 0; i < users.length; i++) {
                users[i].uid = await createMockUser(userApp, users[i].data.email, passwords[i], true, adminAuth)
            }
            await sleep(1000)
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])

            await createMockCeremony(adminFirestore, ceremony, circuits)
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await createS3Bucket(userFunctions, bucketName)
            await sleep(1000)
            // upload all files to S3
            await uploadFileToS3(bucketName, r1csStorageFilePath, r1csPath)
            await uploadFileToS3(bucketName, zkeyStorageFilePath, zkeyPath)
            await uploadFileToS3(bucketName, finalZkeyStorageFilePath, finalZkeyPath)
            await uploadFileToS3(bucketName, potStorageFilePath, potPath)
            await sleep(1000)
        })

        after(async () => {
            await cleanUpMockUsers(adminAuth, adminFirestore, users)
            await deleteAdminApp()
            if (fs.existsSync(outputDirectory)) fs.rmSync(outputDirectory, { recursive: true, force: true })

            // delete s3 objects and bucket
            await deleteObjectFromS3(bucketName, r1csStorageFilePath)
            await deleteObjectFromS3(bucketName, zkeyStorageFilePath)
            await deleteObjectFromS3(bucketName, finalZkeyStorageFilePath)
            await deleteObjectFromS3(bucketName, potStorageFilePath)
            await deleteBucket(bucketName)
        })

        it("should return true for a ceremony which was finalized successfully", async () => {
            expect(
                await verifyCeremony(
                    userFunctions,
                    userFirestore,
                    ceremony.data.prefix!,
                    outputDirectory,
                    solidityVersion,
                    wasmPath,
                    {
                        x1: "5",
                        x2: "10",
                        x3: "1",
                        x4: "2"
                    },
                    verifierTemplatePath,
                    signer
                )
            ).to.be.true
        })
        it("should return false for a ceremony which was not finalized successfully", async () => {
            await expect(
                verifyCeremony(
                    userFunctions,
                    userFirestore,
                    "invalid",
                    outputDirectory,
                    solidityVersion,
                    wasmPath,
                    {
                        x1: "5",
                        x2: "10",
                        x3: "1",
                        x4: "2"
                    },
                    verifierTemplatePath,
                    signer
                )
            ).to.be.rejected
        })
    }
})
