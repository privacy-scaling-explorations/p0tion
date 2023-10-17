import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth"
import { randomBytes } from "crypto"
import { cwd } from "process"
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
    envType,
    sleep
} from "../utils/index"
import {
    checkAndPrepareCoordinatorForFinalization,
    commonTerms,
    createS3Bucket,
    finalizeCeremony,
    finalizeCircuit,
    getBucketName,
    getCurrentFirebaseAuthUser,
    getDocumentById,
    getVerificationKeyStorageFilePath,
    getVerifierContractStorageFilePath,
    verificationKeyAcronym,
    verifierSmartContractAcronym
} from "../../src/index"
import { fakeCeremoniesData, fakeCircuitsData, fakeUsersData } from "../data/samples"
import {
    cleanUpRecursively,
    createMockContribution,
    createMockParticipant,
    deleteBucket,
    deleteObjectFromS3,
    mockCeremoniesCleanup,
    uploadFileToS3
} from "../utils/storage"
import { generateFakeParticipant } from "../data/generators"
import {
    CeremonyState,
    ParticipantContributionStep,
    ParticipantStatus,
    TestingEnvironment
} from "../../src/types/enums"

chai.use(chaiAsPromised)

describe("Finalize", () => {
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
            fakeCircuitsData.fakeCircuitForFinalization.uid,
            finalContribution,
            contributionId
        )
    })

    describe("checkAndPrepareCoordinatorForFinalization", () => {
        it("should revert when called with an invalid ceremony id", async () => {
            // sign in as coordinator
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            await sleep(5000)
            await expect(checkAndPrepareCoordinatorForFinalization(userFunctions, "invalid")).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
            )
        })
        it("should revert when the ceremony state is not CLOSED", async () => {
            await expect(
                checkAndPrepareCoordinatorForFinalization(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            ).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
            )
        })
        it("should return true after updating the participant (coordinator) status to FINALIZING", async () => {
            const result = await checkAndPrepareCoordinatorForFinalization(
                userFunctions,
                fakeCeremoniesData.fakeCeremonyClosedDynamic.uid
            )
            expect(result).to.be.true
        })
        it("should not be possible to prepare coordinator for finalization twice", async () => {
            const result = await checkAndPrepareCoordinatorForFinalization(
                userFunctions,
                fakeCeremoniesData.fakeCeremonyClosedDynamic.uid
            )
            expect(result).to.be.false
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
            await sleep(3000)
            const result = await checkAndPrepareCoordinatorForFinalization(
                userFunctions,
                fakeCeremoniesData.fakeCeremonyClosedDynamic.uid
            )
            expect(result).to.be.false
        })
        it("should revert when called by a non-coordinator", async () => {
            // sign in as a non-coordinator
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            // call the function
            await expect(
                checkAndPrepareCoordinatorForFinalization(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyClosedDynamic.uid
                )
            ).to.be.rejectedWith("You do not have privileges to perform this operation.")
        })
        it("should revert when called without being authenticated", async () => {
            await signOut(userAuth)
            await expect(
                checkAndPrepareCoordinatorForFinalization(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyClosedDynamic.uid
                )
            ).to.be.rejectedWith("You do not have privileges to perform this operation.")
        })
    })

    // runs only on prod env due to required S3 creds to clean up
    if (envType === TestingEnvironment.PRODUCTION) {
        describe("finalizeCircuit", () => {
            const bucketName = getBucketName(
                fakeCeremoniesData.fakeCeremonyClosedDynamic.data.prefix,
                ceremonyBucketPostfix
            )
            const circuitData = fakeCircuitsData.fakeCircuitForFinalization
            // Filenames.
            const verificationKeyLocalPath = `${cwd()}/packages/actions/test/data/artifacts/${
                circuitData?.data.prefix
            }_${verificationKeyAcronym}.json`
            const verifierContractLocalPath = `${cwd()}/packages/actions/test/data/artifacts/${
                circuitData?.data.prefix
            }_${verifierSmartContractAcronym}.sol`

            // Get storage paths.
            const verificationKeyStoragePath = getVerificationKeyStorageFilePath(
                circuitData?.data.prefix!,
                `${circuitData.data.prefix!}_${verificationKeyAcronym}.json`
            )
            const verifierContractStoragePath = getVerifierContractStorageFilePath(
                circuitData?.data.prefix!,
                `${circuitData?.data.prefix}_${verifierSmartContractAcronym}.sol`
            )

            beforeAll(async () => {
                // need to upload data into the bucket
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                const currentUser = getCurrentFirebaseAuthUser(userApp)
                await currentUser.getIdToken(true)
                await sleep(5000)
                await createS3Bucket(userFunctions, bucketName)
                await uploadFileToS3(bucketName, verificationKeyStoragePath, verificationKeyLocalPath)
                await uploadFileToS3(bucketName, verifierContractStoragePath, verifierContractLocalPath)
                await createMockCeremony(adminFirestore, fakeCeremoniesData.fakeCeremonyClosedDynamic, circuitData)
            })
            it("should revert when called with an invalid ceremony id", async () => {
                await expect(
                    finalizeCircuit(
                        userFunctions,
                        "invalid",
                        fakeCircuitsData.fakeCircuitSmallContributors.uid,
                        bucketName,
                        `handle-id`
                    )
                ).to.be.rejectedWith(
                    "Unable to find a document with the given identifier for the provided collection path."
                )
            })
            it("should revert when called with an invalid circuit id", async () => {
                await expect(
                    finalizeCircuit(
                        userFunctions,
                        fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
                        "invalid",
                        bucketName,
                        `handle-id`
                    )
                ).to.be.rejectedWith(
                    "Unable to find a document with the given identifier for the provided collection path."
                )
            })
            it("should revert when given the wrong bucket name", async () => {
                await expect(
                    finalizeCircuit(
                        userFunctions,
                        fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
                        circuitData.uid,
                        "invalidBucketName",
                        `handle-id`
                    )
                ).to.be.rejectedWith("Unable to download the AWS S3 object from the provided ceremony bucket.")
            })
            it("should succesfully finalize the last contribution", async () => {
                // prepare coordinator for finalization
                await checkAndPrepareCoordinatorForFinalization(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyClosedDynamic.uid
                )
                // call the function
                await expect(
                    finalizeCircuit(
                        userFunctions,
                        fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
                        circuitData.uid,
                        bucketName,
                        `handle-id`
                    )
                ).to.be.fulfilled
            })
            it("should revert when called by a non-coordinator", async () => {
                // sign in as a non-coordinator
                await signOut(userAuth)
                await sleep(1000)
                await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
                // call the function
                await expect(
                    finalizeCircuit(
                        userFunctions,
                        fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
                        fakeCircuitsData.fakeCircuitSmallContributors.uid,
                        bucketName,
                        `handle-id`
                    )
                ).to.be.rejectedWith("You do not have privileges to perform this operation.")
            })
            it("should revert when called without being authenticated", async () => {
                await signOut(userAuth)
                await expect(
                    finalizeCircuit(
                        userFunctions,
                        fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
                        fakeCircuitsData.fakeCircuitSmallContributors.uid,
                        bucketName,
                        `handle-id`
                    )
                ).to.be.rejectedWith("You do not have privileges to perform this operation.")
            })

            afterAll(async () => {
                await cleanUpMockCeremony(
                    adminFirestore,
                    fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
                    circuitData.uid
                )
                await deleteObjectFromS3(bucketName, verificationKeyStoragePath)
                await deleteObjectFromS3(bucketName, verifierContractStoragePath)
                await deleteBucket(bucketName)
            })
        })
    }

    describe("finalizeCeremony", () => {
        beforeAll(async () => {
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyClosedDynamic,
                fakeCircuitsData.fakeCircuitSmallContributors
            )
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
        it("should revert when called with an invalid ceremony id", async () => {
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            await sleep(5000)
            await expect(finalizeCeremony(userFunctions, "invalid")).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
            )
        })
        it("should revert when called with the id of a ceremony that is not in the FINALIZING status", async () => {
            await expect(
                finalizeCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            ).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
            )
        })
        it("should finalize and update the ceremony state to FINALIZED", async () => {
            // prepare coordinator for finalization
            await checkAndPrepareCoordinatorForFinalization(
                userFunctions,
                fakeCeremoniesData.fakeCeremonyClosedDynamic.uid
            )

            // call the function
            await expect(finalizeCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid)).to.be
                .fulfilled

            const ceremony = await getDocumentById(
                userFirestore,
                commonTerms.collections.ceremonies.name,
                fakeCeremoniesData.fakeCeremonyClosedDynamic.uid
            )
            const ceremonyData = ceremony.data()
            expect(ceremonyData?.state).to.be.eq(CeremonyState.FINALIZED)
        })
        it("should revert when called with the id of a ceremony that is not in the COMPLETED state", async () => {
            await expect(
                finalizeCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid)
            ).to.be.rejectedWith("Unable to finalize the ceremony.")
        })
        it("should revert when called by a non-coordinator", async () => {
            // sign in as a non-coordinator
            await signOut(userAuth)
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await sleep(2000)
            // call the function
            await expect(
                finalizeCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid)
            ).to.be.rejectedWith("You do not have privileges to perform this operation.")
        })
        it("should revert when called without being authenticated", async () => {
            await signOut(userAuth)
            await expect(
                finalizeCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid)
            ).to.be.rejectedWith("You do not have privileges to perform this operation.")
        })
        afterAll(async () => {
            await cleanUpRecursively(adminFirestore, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid)
        })
    })

    afterAll(async () => {
        // Clean ceremony and user from DB.
        await cleanUpMockUsers(adminAuth, adminFirestore, users)

        // Complete cleanup.
        await mockCeremoniesCleanup(adminFirestore)

        // Delete app.
        await deleteAdminApp()
    })
})
