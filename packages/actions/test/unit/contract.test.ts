import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import dotenv from "dotenv"
import fs from "fs"
import { cwd } from "process"
import { ethers } from "hardhat"
import { getAuth, signInWithEmailAndPassword } from "firebase/auth"
import { Signer } from "ethers"
import {
    cleanUpMockCeremony,
    cleanUpMockContribution,
    cleanUpMockParticipant,
    cleanUpMockUsers,
    createMockCeremony,
    createMockContribution,
    createMockParticipant,
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
import { ParticipantContributionStep, ParticipantStatus, TestingEnvironment } from "../../src/types/enums"
import {
    computeSHA256ToHex,
    createS3Bucket,
    formatSolidityCalldata,
    generateGROTH16Proof,
    getBucketName,
    getPotStorageFilePath,
    getR1csStorageFilePath,
    getVerificationKeyStorageFilePath,
    getVerifierContractStorageFilePath,
    getZkeyStorageFilePath,
    verificationKeyAcronym,
    verifierSmartContractAcronym,
    verifyCeremony,
    verifyGROTH16Proof
} from "../../src"
import { fakeCeremoniesData, fakeCircuitsData, fakeUsersData } from "../data/samples"
import { generateFakeParticipant } from "../data/generators"
import { UserDocumentReferenceAndData } from "../../src/types"

chai.use(chaiAsPromised)
dotenv.config()

/**
 * Unit test for Verification utilities.
 */

describe("Smart Contract", () => {
    if (envType === TestingEnvironment.PRODUCTION) {
        let contractFactory: any
        let mockVerifier: any

        const wasmPath = `${cwd()}/test/data/artifacts/circuit.wasm`
        const vkeyPath = `${cwd()}/test/data/artifacts/circuit_vkey.json`
        const lastZkeyPath = `${cwd()}/test/data/artifacts/circuit_0001.zkey`
        const r1csPath = `${cwd()}/test/data/artifacts/circuit.r1cs`
        const potPath = `${cwd()}/test/data/artifacts/powersOfTau28_hez_final_02.ptau`
        const finalZkeyPath = `${cwd()}/test/data/artifacts/circuit_final.zkey`
        const outputDirectory = `${cwd()}/test/data/artifacts/verification`
        const verifierTemplatePath = `${cwd()}/../../node_modules/snarkjs/templates/verifier_groth16.sol.ejs`
        const verifierPath = `${cwd()}/test/data/artifacts/circuit_verifier.sol`
        const verificationKeyPath = `${cwd()}/test/data/artifacts/circuit_vkey.json`
        const inputsPath = `${cwd()}/test/data/artifacts/inputs.json`

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
            it("should return true when provided with a valid SNARK proof", async () => {
                // gen proof locally
                const inputs = {
                    x1: "5",
                    x2: "10",
                    x3: "1",
                    x4: "2"
                }
                const { proof, publicSignals } = await generateGROTH16Proof(inputs, finalZkeyPath, wasmPath)
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

        describe("Verify a ceremony integrity", () => {
            const finalizationBeacon = "1234567890"
            // the id that was applied to the final contribution
            // with snarkJs locally (circuit_final.zkey)
            // testing only
            const coordinatorIdentifier = "final"
            let signer: Signer

            // this data is shared between other prod tests (download artifacts and verify ceremony)
            const ceremony = fakeCeremoniesData.fakeCeremonyOpenedFixed

            const circuit = fakeCircuitsData.fakeCircuitForFinalization

            const { ceremonyBucketPostfix } = getStorageConfiguration()

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

            // Initialize admin and user services.
            const { adminFirestore, adminAuth } = initializeAdminServices()
            const { userApp, userFirestore, userFunctions } = initializeUserServices()
            const userAuth = getAuth(userApp)

            const users: UserDocumentReferenceAndData[] = [fakeUsersData.fakeUser1]
            const passwords = generateUserPasswords(users.length)

            // pre conditions:
            // * create user
            // * create bucket
            // * upload files to bucket
            // * create ceremony
            // * create participant
            // * create contribution
            before(async () => {
                ;[signer] = await ethers.getSigners()

                for (let i = 0; i < users.length; i++) {
                    users[i].uid = await createMockUser(userApp, users[i].data.email, passwords[i], true, adminAuth)
                }
                await sleep(1000)
                await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])

                // add coordinator final contribution
                const coordinatorParticipant = generateFakeParticipant({
                    uid: users[0].uid,
                    data: {
                        userId: users[0].uid,
                        contributionProgress: 1,
                        contributionStep: ParticipantContributionStep.COMPLETED,
                        status: ParticipantStatus.DONE,
                        contributions: [],
                        lastUpdated: Date.now(),
                        contributionStartedAt: Date.now() - 100,
                        verificationStartedAt: Date.now(),
                        tempContributionData: {
                            contributionComputationTime: Date.now() - 100,
                            uploadId: "001",
                            chunks: []
                        }
                    }
                })

                const finalContribution = {
                    // here we are passing this coordinator identifier
                    // instead of the actual uid of the coordinator
                    // as that's what was applied to the test zKey
                    participantId: coordinatorIdentifier,
                    contributionComputationTime: new Date().valueOf(),
                    verificationComputationTime: new Date().valueOf(),
                    zkeyIndex: `final`,
                    files: {},
                    lastUpdate: new Date().valueOf(),
                    beacon: {
                        value: finalizationBeacon,
                        hash: computeSHA256ToHex(finalizationBeacon)
                    }
                }
                await createMockCeremony(adminFirestore, ceremony, circuit)

                await createMockParticipant(adminFirestore, ceremony.uid, users[0].uid, coordinatorParticipant)
                await createMockContribution(adminFirestore, ceremony.uid, circuit.uid, finalContribution, users[0].uid)

                await createS3Bucket(userFunctions, bucketName)
                await sleep(1000)
                // upload all files to S3
                await uploadFileToS3(bucketName, r1csStorageFilePath, r1csPath)
                await uploadFileToS3(bucketName, zkeyStorageFilePath, lastZkeyPath)
                await uploadFileToS3(bucketName, finalZkeyStorageFilePath, finalZkeyPath)
                await uploadFileToS3(bucketName, potStorageFilePath, potPath)
                await uploadFileToS3(bucketName, verifierStorageFilePath, verifierPath)
                await uploadFileToS3(bucketName, verificationKeyStoragePath, verificationKeyPath)
                await sleep(1000)
            })

            // clean up after tests
            after(async () => {
                await cleanUpMockUsers(adminAuth, adminFirestore, users)
                await cleanUpMockParticipant(adminFirestore, ceremony.uid, users[0].uid)
                await cleanUpMockContribution(adminFirestore, ceremony.uid, circuit.uid, users[0].uid)
                await cleanUpMockCeremony(adminFirestore, ceremony.uid, circuit.uid)
                await deleteAdminApp()
                if (fs.existsSync(outputDirectory)) fs.rmSync(outputDirectory, { recursive: true, force: true })

                // delete s3 objects and bucket
                await deleteObjectFromS3(bucketName, r1csStorageFilePath)
                await deleteObjectFromS3(bucketName, zkeyStorageFilePath)
                await deleteObjectFromS3(bucketName, finalZkeyStorageFilePath)
                await deleteObjectFromS3(bucketName, potStorageFilePath)
                await deleteObjectFromS3(bucketName, verifierStorageFilePath)
                await deleteObjectFromS3(bucketName, verificationKeyStoragePath)
                await sleep(500)
                await deleteBucket(bucketName)
            })

            it("should return true for a ceremony which was finalized successfully", async () => {
                await expect(
                    verifyCeremony(
                        userFunctions,
                        userFirestore,
                        ceremony.data.prefix!,
                        outputDirectory,
                        wasmPath,
                        inputsPath,
                        verifierTemplatePath,
                        signer,
                        coordinatorIdentifier
                    )
                ).to.be.fulfilled
            })
            it("should return false for a ceremony which was not finalized successfully", async () => {
                await expect(
                    verifyCeremony(
                        userFunctions,
                        userFirestore,
                        "invalid",
                        outputDirectory,
                        wasmPath,
                        inputsPath,
                        verifierTemplatePath,
                        signer,
                        coordinatorIdentifier
                    )
                ).to.be.rejected
            })
        })
    }
})
