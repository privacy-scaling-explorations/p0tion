import chai, { assert, expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import fs from "fs"
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth"
import { randomBytes } from "crypto"
import {
    deleteAdminApp,
    initializeAdminServices,
    initializeUserServices,
    createMockUser,
    generateUserPasswords,
    cleanUpMockUsers,
    cleanUpMockCeremony,
    createMockCeremony,
    getStorageConfiguration,
    envType
} from "../utils"
import {
    checkAndPrepareCoordinatorForFinalization,
    commonTerms,
    createS3Bucket,
    finalizeCeremony,
    finalizeLastContribution,
    getBucketName,
    getDocumentById,
    getVerificationKeyStorageFilePath,
    getVerifierContractStorageFilePath
} from "../../src"
import { fakeCeremoniesData, fakeCircuitsData, fakeUsersData } from "../data/samples"
import {
    cleanUpMockContribution,
    cleanUpMockParticipant,
    createMockContribution,
    createMockParticipant,
    deleteBucket,
    deleteObjectFromS3,
    uploadFileToS3
} from "../utils/storage"
import { generateFakeParticipant } from "../data/generators"
import { ParticipantContributionStep, ParticipantStatus, TestingEnvironment } from "../../src/types/enums"

chai.use(chaiAsPromised)

describe("Setup", () => {
    // test users (2nd is coordinator)
    const users = [fakeUsersData.fakeUser1, fakeUsersData.fakeUser2, fakeUsersData.fakeUser3]
    const passwords = generateUserPasswords(3)

    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp, userFunctions, userFirestore } = initializeUserServices()
    const userAuth = getAuth(userApp)

    const { ceremonyBucketPostfix } = getStorageConfiguration()

    const contributionId = randomBytes(20).toString("hex")

    beforeAll(async () => {
        // create two users and set the second and third as coordinator
        for (let i = 0; i < passwords.length; i++) {
            const uid = await createMockUser(
                userApp,
                users[i].data.email,
                passwords[i],
                i === passwords.length - 1 || i === passwords.length - 2,
                adminAuth
            )
            users[i].uid = uid
        }

        // create a couple of ceremonies
        await createMockCeremony(
            adminFirestore,
            fakeCeremoniesData.fakeCeremonyOpenedFixed,
            fakeCircuitsData.fakeCircuitSmallNoContributors
        )
        await createMockCeremony(
            adminFirestore,
            fakeCeremoniesData.fakeCeremonyClosedDynamic,
            fakeCircuitsData.fakeCircuitSmallContributors
        )
        // add coordinator final contribution
        const coordinatorParticipant = generateFakeParticipant({
            uid: users[1].uid,
            data: {
                userId: users[1].uid,
                contributionProgress: 2,
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
        await createMockParticipant(
            adminFirestore,
            fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
            users[1].uid,
            coordinatorParticipant
        )
        // create another coordinator contribution but no in the DONE status
        const coordinatorParticipant2 = generateFakeParticipant({
            uid: users[2].uid,
            data: {
                userId: users[2].uid,
                contributionProgress: 1,
                contributionStep: ParticipantContributionStep.COMPLETED,
                status: ParticipantStatus.CONTRIBUTING,
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
        await createMockParticipant(
            adminFirestore,
            fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
            users[2].uid,
            coordinatorParticipant2
        )

        // add a contribution
        const finalContribution = {
            participantId: users[1].uid,
            contributionComputationTime: new Date().valueOf(),
            verificationComputationTime: new Date().valueOf(),
            zkeyIndex: `final`,
            files: {},
            lastUpdate: new Date().valueOf()
        }
        await createMockContribution(
            adminFirestore,
            fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
            fakeCircuitsData.fakeCircuitSmallContributors.uid,
            finalContribution,
            contributionId
        )
    })

    describe("checkAndPrepareCoordinatorForFinalization", () => {
        it("should revert when called by a non-coordinator", async () => {
            // sign in as a non-coordinator
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            // call the function
            assert.isRejected(
                checkAndPrepareCoordinatorForFinalization(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyClosedDynamic.uid
                )
            )
        })
        it("should revert when called without being authenticated", async () => {
            await signOut(userAuth)
            assert.isRejected(
                checkAndPrepareCoordinatorForFinalization(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyClosedDynamic.uid
                )
            )
        })
        it("should revert when called with an invalid ceremony id", async () => {
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            assert.isRejected(checkAndPrepareCoordinatorForFinalization(userFunctions, "invalid"))
        })
        it("should revert when the ceremony state is not CLOSED", async () => {
            assert.isRejected(
                checkAndPrepareCoordinatorForFinalization(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            )
        })
        it("should return false if the coordinator contributor status is not DONE or hasn't completed all contributions", async () => {
            /*
             if (
                    participantData?.contributionProgress === circuits.length + 1 ||
                    participantData?.status === ParticipantStatus.DONE
                )
            */
            // sign in as second coordinator
            await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
            const { data: result } = await checkAndPrepareCoordinatorForFinalization(
                userFunctions,
                fakeCeremoniesData.fakeCeremonyClosedDynamic.uid
            )
            expect(result).to.be.false
        })
        it("should return true after updating the participant (coordinator) status to FINALIZING", async () => {
            // sign in as first coordinator
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            const { data: result } = await checkAndPrepareCoordinatorForFinalization(
                userFunctions,
                fakeCeremoniesData.fakeCeremonyClosedDynamic.uid
            )
            expect(result).to.be.true
        })
        it.skip("should not be possible to prepare coordinator for finalization twice", async () => {
            // @todo check if this is expect behaviour to allow for multiple successful calls
            const { data: result } = await checkAndPrepareCoordinatorForFinalization(
                userFunctions,
                fakeCeremoniesData.fakeCeremonyClosedDynamic.uid
            )
            expect(result).to.be.false
        })
    })

    // runs only on prod env due to required S3 creds to clean up
    if (envType === TestingEnvironment.PRODUCTION) {
        describe("finalizeLastContribution", () => {
            const bucketName = getBucketName(
                fakeCeremoniesData.fakeCeremonyClosedDynamic.data.prefix,
                ceremonyBucketPostfix
            )
            const circuitData = fakeCircuitsData.fakeCircuitSmallContributors
            // Filenames.
            const verificationKeyFilename = `${circuitData?.data.prefix}_vkey.json`
            const verifierContractFilename = `${circuitData?.data.prefix}_verifier.sol`

            // Get storage paths.
            const verificationKeyStoragePath = getVerificationKeyStorageFilePath(
                circuitData?.data.prefix!,
                verificationKeyFilename
            )
            const verifierContractStoragePath = getVerifierContractStorageFilePath(
                circuitData?.data.prefix!,
                verifierContractFilename
            )

            fs.writeFileSync(verificationKeyFilename, JSON.stringify({ test: "test" }))
            fs.writeFileSync(verifierContractFilename, "pragma solidity 0.8.0")
            beforeAll(async () => {
                // need to upload data into the bucket
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                await createS3Bucket(userFunctions, bucketName)
                // console.log("Uploading", verificationKey)
                await uploadFileToS3(bucketName, verificationKeyStoragePath, verificationKeyFilename)
                await uploadFileToS3(bucketName, verifierContractStoragePath, verifierContractFilename)
            })
            it("should revert when called by a non-coordinator", async () => {
                // sign in as a non-coordinator
                await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
                // call the function
                assert.isRejected(
                    finalizeLastContribution(
                        userFunctions,
                        fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
                        fakeCircuitsData.fakeCircuitSmallContributors.uid,
                        bucketName
                    )
                )
            })
            it("should revert when called without being authenticated", async () => {
                await signOut(userAuth)
                assert.isRejected(
                    finalizeLastContribution(
                        userFunctions,
                        fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
                        fakeCircuitsData.fakeCircuitSmallContributors.uid,
                        bucketName
                    )
                )
            })
            it("should revert when called with an invalid ceremony id", async () => {
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                assert.isRejected(
                    finalizeLastContribution(
                        userFunctions,
                        "invalid",
                        fakeCircuitsData.fakeCircuitSmallContributors.uid,
                        bucketName
                    )
                )
            })
            it("should revert when called with an invalid circuit id", async () => {
                assert.isRejected(
                    finalizeLastContribution(
                        userFunctions,
                        fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
                        "invalid",
                        bucketName
                    )
                )
            })
            it("should revert when called by a coordinator that has not completed all contributions", async () => {
                // sign in as second coordinator
                await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
                assert.isRejected(
                    finalizeLastContribution(
                        userFunctions,
                        fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
                        fakeCircuitsData.fakeCircuitSmallContributors.uid,
                        bucketName
                    )
                )
            })
            it("should revert when given the wrong bucket name", async () => {
                assert.isRejected(
                    finalizeLastContribution(
                        userFunctions,
                        fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
                        fakeCircuitsData.fakeCircuitSmallContributors.uid,
                        "invalidBucketName"
                    )
                )
            })
            it.skip("should succesfully finalize the last contribution", async () => {
                // sign in as coordinator 1
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                // prepare coordinator for finalization
                await checkAndPrepareCoordinatorForFinalization(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyClosedDynamic.uid
                )
                // call the function
                assert.isFulfilled(
                    finalizeLastContribution(
                        userFunctions,
                        fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
                        fakeCircuitsData.fakeCircuitSmallContributors.uid,
                        bucketName
                    )
                )
            })

            afterAll(async () => {
                await deleteObjectFromS3(bucketName, verificationKeyStoragePath)
                await deleteObjectFromS3(bucketName, verifierContractStoragePath)
                await deleteBucket(bucketName)
                fs.unlinkSync(verificationKeyFilename)
                fs.unlinkSync(verifierContractFilename)
            })
        })
    }

    describe("finalizeCeremony", () => {
        beforeAll(async () => {
            // create finalizing participant
            const finalizingParticipant = generateFakeParticipant({
                uid: users[2].uid,
                data: {
                    userId: users[2].uid,
                    contributionProgress: 1,
                    contributionStep: ParticipantContributionStep.COMPLETED,
                    status: ParticipantStatus.FINALIZING,
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
            await createMockParticipant(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
                users[2].uid,
                finalizingParticipant
            )
        })
        it("should revert when called by a non-coordinator", async () => {
            // sign in as a non-coordinator
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            // call the function
            assert.isRejected(finalizeCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid))
        })
        it("should revert when called without being authenticated", async () => {
            await signOut(userAuth)
            assert.isRejected(finalizeCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid))
        })
        it("should revert when called with an invalid ceremony id", async () => {
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            assert.isRejected(finalizeCeremony(userFunctions, "invalid"))
        })
        it("should revert when called with the id of a ceremony that is not in the FINALIZING status", async () => {
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            assert.isRejected(finalizeCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid))
        })
        it("should revert when called with the id of a ceremony that is not in the COMPLETED state", async () => {
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            assert.isRejected(finalizeCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid))
        })
        it.skip("should update the ceremony state to FINALIZED and coordinator status to FINALIZED", async () => {
            let ceremonyDoc = await getDocumentById(
                userFirestore,
                commonTerms.collections.ceremonies.name,
                fakeCeremoniesData.fakeCeremonyClosedDynamic.uid
            )
            let data = ceremonyDoc.data()
            console.log(data)
            // let participantDoc = await getDocumentById(
            //     userFirestore,
            //     commonTerms.collections.participants.name,
            //     users[2].uid
            // )
            // let participantData = participantDoc.data()
            // console.log(participantData)
            // sign in as coordinator 1
            await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
            // call the function
            assert.isFulfilled(finalizeCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid))
            ceremonyDoc = await getDocumentById(
                userFirestore,
                commonTerms.collections.ceremonies.name,
                fakeCeremoniesData.fakeCeremonyClosedDynamic.uid
            )
            data = ceremonyDoc.data()
            console.log(data)
        })
        afterAll(async () => {
            await cleanUpMockParticipant(adminFirestore, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid, users[2].uid)
        })
    })

    afterAll(async () => {
        // Clean ceremony and user from DB.
        await cleanUpMockUsers(adminAuth, adminFirestore, users)
        // remove participants
        await cleanUpMockParticipant(adminFirestore, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid, users[1].uid)
        await cleanUpMockParticipant(adminFirestore, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid, users[2].uid)
        // Remove ceremonies.
        await cleanUpMockCeremony(
            adminFirestore,
            fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
            fakeCircuitsData.fakeCircuitSmallNoContributors.uid
        )
        await cleanUpMockCeremony(
            adminFirestore,
            fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
            fakeCircuitsData.fakeCircuitSmallContributors.uid
        )
        // Remove contribution
        await cleanUpMockContribution(
            adminFirestore,
            fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
            fakeCircuitsData.fakeCircuitSmallContributors.uid,
            contributionId
        )
        // Delete app.
        await deleteAdminApp()
    })
})
