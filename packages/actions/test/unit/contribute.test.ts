import chai, { assert, expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth"
import { fakeCeremoniesData, fakeCircuitsData, fakeParticipantsData, fakeUsersData } from "../data/samples"
import {
    checkParticipantForCeremony,
    convertToGB,
    getCeremonyCircuits,
    getNextCircuitForContribution,
    getOpenedCeremonies,
    getZkeysSpaceRequirementsForContributionInGB,
    makeProgressToNextContribution,
    permanentlyStoreCurrentContributionTimeAndHash,
    progressToNextContributionStep,
    resumeContributionAfterTimeoutExpiration,
    verifyContribution,
    temporaryStoreCurrentContributionMultiPartUploadId,
    temporaryStoreCurrentContributionUploadedChunkData,
    getParticipantsCollectionPath
} from "../../src"
import {
    cleanUpMockCeremony,
    cleanUpMockUsers,
    createMockCeremony,
    createMockUser,
    createMockTimedOutContribution,
    deleteAdminApp,
    generateUserPasswords,
    initializeAdminServices,
    initializeUserServices,
    sleep,
    cleanUpMockTimeout,
    createMockParticipant,
    cleanUpMockParticipant
} from "../utils"
import { generateFakeParticipant } from "../data/generators"
import { ParticipantContributionStep, ParticipantStatus } from "../../src/types/enums"

chai.use(chaiAsPromised)

/**
 * Unit tests for the contribute action
 */
describe("Contribute", () => {
    // Init admin services.
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp, userFirestore, userFunctions } = initializeUserServices()
    const userAuth = getAuth(userApp)

    const users = [fakeUsersData.fakeUser1, fakeUsersData.fakeUser2, fakeUsersData.fakeUser3]
    const passwords = generateUserPasswords(3)

    // setup - create few users and a mock ceremony
    beforeAll(async () => {
        // create users
        for (let i = 0; i < passwords.length; i++) {
            const uid = await createMockUser(
                userApp,
                users[i].data.email,
                passwords[i],
                i === passwords.length - 1,
                adminAuth
            )
            users[i].uid = uid
        }
    })

    describe("convertToGB", () => {
        it("should convert bytes to GB correctly", () => {
            expect(convertToGB(1000000000, true)).to.equal(0.9313225746154785)
            expect(convertToGB(1000000000, false)).to.equal(953.67431640625)
        })
    })

    describe("getZkeysSpaceRequirementsForContributionInGB", () => {
        it("should calculate the space requirements correctly", () => {
            expect(getZkeysSpaceRequirementsForContributionInGB(1000000000)).to.equal(1.862645149230957)
            expect(getZkeysSpaceRequirementsForContributionInGB(1073741824)).to.equal(2)
        })
    })

    describe("getOpenedCeremonies", () => {
        it("should return an empty array when no ceremonies are open", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const ceremonies = await getOpenedCeremonies(userFirestore)
            expect(ceremonies.length).to.be.eq(0)
        })
        it("should fail when not authenticated", async () => {
            await signOut(userAuth)
            await expect(getOpenedCeremonies(userFirestore)).to.be.rejectedWith("Missing or insufficient permissions.")
        })
        it("should allow to retrieve all opened ceremonies", async () => {
            // create ceremony
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed,
                fakeCircuitsData.fakeCircuitSmallNoContributors
            )
            // auth
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const ceremonies = await getOpenedCeremonies(userFirestore)
            expect(ceremonies.length).to.be.gt(0)
        })
        it("should return the same data to coordinators and participants", async () => {
            // auth
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const ceremonies = await getOpenedCeremonies(userFirestore)
            // auth
            await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
            const ceremonies2 = await getOpenedCeremonies(userFirestore)
            expect(ceremonies2).to.deep.equal(ceremonies)
        })
        afterAll(async () => {
            await cleanUpMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                fakeCircuitsData.fakeCircuitSmallNoContributors.uid
            )
        })
    })

    describe("getCeremonyCircuits", () => {
        // create a mock ceremony before running the tests
        beforeAll(async () => {
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed,
                fakeCircuitsData.fakeCircuitSmallNoContributors
            )
        })
        it("should fail when not authenticated", async () => {
            await signOut(userAuth)
            await expect(
                getCeremonyCircuits(userFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            ).to.be.rejectedWith("Missing or insufficient permissions.")
        })
        it("should return the circuits for the specified ceremony", async () => {
            // auth
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const circuits = await getCeremonyCircuits(userFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            expect(circuits.length).to.be.gt(0)
        })
        it("should not return any results for a non-existing ceremony", async () => {
            // auth
            const circuits = await getCeremonyCircuits(userFirestore, "non-existing")
            expect(circuits.length).to.equal(0)
        })
        it("should revert when given the wrong firebase db argument", async () => {
            // auth
            await expect(
                getCeremonyCircuits({} as any, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            ).to.be.rejectedWith(
                "Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore"
            )
        })
        it("should return the same data to coordinators and participants", async () => {
            // auth
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const circuits = await getCeremonyCircuits(userFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            // auth
            await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
            const circuits2 = await getCeremonyCircuits(userFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            expect(circuits2).to.deep.equal(circuits)
        })
        afterAll(async () => {
            await cleanUpMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                fakeCircuitsData.fakeCircuitSmallNoContributors.uid
            )
        })
    })

    describe("getNextCircuitForContribution", () => {
        beforeAll(async () => {
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed,
                fakeCircuitsData.fakeCircuitSmallNoContributors
            )
        })
        it("should revert when there are no circuits to contribute to", async () => {
            const circuits = await getCeremonyCircuits(userFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            expect(() => getNextCircuitForContribution(circuits, 500)).to.throw(
                "Contribute-0001: Something went wrong when retrieving the data from the database"
            )
        })
        it("should return the next circuit for contribution", async () => {
            const circuits = await getCeremonyCircuits(userFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            const nextCircuit = getNextCircuitForContribution(circuits, 1)
            expect(nextCircuit).to.not.be.null
        })
        it("should revert when passing an empty Circuit object", () => {
            expect(() => getNextCircuitForContribution([], 1)).to.throw(
                "Contribute-0001: Something went wrong when retrieving the data from the database"
            )
        })
        afterAll(async () => {
            await cleanUpMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                fakeCircuitsData.fakeCircuitSmallNoContributors.uid
            )
        })
    })

    describe("checkParticipantForCeremony", () => {
        beforeAll(async () => {
            // create open ceremony
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed,
                fakeCircuitsData.fakeCircuitSmallNoContributors
            )
            // create closed ceremony
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyClosedDynamic,
                fakeCircuitsData.fakeCircuitSmallNoContributors
            )
            // create locked out participant
            await createMockTimedOutContribution(
                adminFirestore,
                users[2].uid,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid
            )
            // create completed participant
            await createMockParticipant(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                users[1].uid,
                fakeParticipantsData.fakeParticipantContributionDone
            )
        })
        it("should revert when not authenticated", async () => {
            await signOut(userAuth)
            await expect(
                checkParticipantForCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            ).to.be.rejectedWith("Unable to retrieve the authenticated user")
        })
        it("should revert when providing an invalid ceremonyId", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await expect(checkParticipantForCeremony(userFunctions, "notExistentId")).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
            )
        })
        it.skip("should revert when passing the ID of a non open ceremony", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await expect(
                checkParticipantForCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid)
            ).to.be.rejectedWith("not sure")
        })
        it("should return false when the user is locked", async () => {
            const ceremonyId = fakeCeremoniesData.fakeCeremonyOpenedFixed.uid
            // use user 2
            await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
            const result = await checkParticipantForCeremony(userFunctions, ceremonyId)
            expect(result).to.be.false
        })
        it("should return false when the user has contributed already to a circuit", async () => {
            const ceremonyId = fakeCeremoniesData.fakeCeremonyOpenedFixed.uid
            // use user 1
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            const result = await checkParticipantForCeremony(userFunctions, ceremonyId)
            expect(result).to.be.false
        })
        it("should return true when the user calling the function is allowed to contribute", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const result = await checkParticipantForCeremony(
                userFunctions,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid
            )
            expect(result).to.be.true
        })
        afterAll(async () => {
            await cleanUpMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                fakeCircuitsData.fakeCircuitSmallNoContributors.uid
            )
            await cleanUpMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
                fakeCircuitsData.fakeCircuitSmallNoContributors.uid
            )
            await cleanUpMockTimeout(adminFirestore, users[2].uid, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            // await cleanUpMockContribution(adminFirestore)
            await cleanUpMockParticipant(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid, users[1].uid)
        })
    })

    describe("permanentlyStoreCurrentContributionTimeAndHash", () => {
        beforeAll(async () => {
            // mock a ceremony
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed,
                fakeCircuitsData.fakeCircuitSmallNoContributors
            )

            const participantContributingStep = generateFakeParticipant({
                uid: users[0].uid,
                data: {
                    userId: users[0].uid,
                    contributionProgress: 1,
                    contributionStep: ParticipantContributionStep.COMPUTING,
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
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                users[0].uid,
                participantContributingStep
            )

            // mock a contribution with user 0
            await sleep(10000)
        })
        it("should revert when not authenticated", async () => {
            await signOut(userAuth)
            await expect(
                permanentlyStoreCurrentContributionTimeAndHash(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    new Date().valueOf(),
                    "contributionHash"
                )
            ).to.be.rejectedWith("Unable to retrieve the authenticated user.")
        })
        it("should revert when providing an invalid ceremonyId", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await expect(
                permanentlyStoreCurrentContributionTimeAndHash(
                    userFunctions,
                    "notExistentId",
                    new Date().valueOf(),
                    "contributionHash"
                )
            ).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
            )
        })
        it("should revert when calling with a user that did not contribute", async () => {
            await signOut(userAuth)
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            await expect(
                permanentlyStoreCurrentContributionTimeAndHash(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    new Date().valueOf(),
                    "contributionHash"
                )
            ).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
            )
        })
        it("should store the contribution time and hash", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await expect(
                permanentlyStoreCurrentContributionTimeAndHash(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    new Date().valueOf(),
                    "contributionHash"
                )
            ).to.not.be.rejected
        })
        afterAll(async () => {
            await cleanUpMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                fakeCircuitsData.fakeCircuitSmallNoContributors.uid
            )
            await cleanUpMockParticipant(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid, users[0].uid)
        })
    })

    describe("makeProgressToNextContribution", () => {
        beforeAll(async () => {
            // mock a ceremony
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed,
                fakeCircuitsData.fakeCircuitSmallNoContributors
            )
            const participantContributing = generateFakeParticipant({
                uid: users[0].uid,
                data: {
                    userId: users[0].uid,
                    contributionProgress: 1,
                    contributionStep: ParticipantContributionStep.COMPLETED,
                    status: ParticipantStatus.WAITING,
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
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                users[0].uid,
                participantContributing
            )
        })
        it("should fail when not authenticated", async () => {
            await signOut(userAuth)
            assert.isRejected(
                makeProgressToNextContribution(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            )
        })
        // @todo check this
        it.skip("should progress the next contribution for the logged in user", async () => {
            // @todo check "FirebaseError: Response is not valid JSON object."
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await expect(makeProgressToNextContribution(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid))
                .to.not.be.rejected
        })
        it.skip("should revert when providing an invalid ceremony ID", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await expect(makeProgressToNextContribution(userFunctions, "notExistentId")).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
            )
        })
        it.skip("should revert when the user has not contributed yet", async () => {
            await signOut(userAuth)
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            await expect(
                makeProgressToNextContribution(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            ).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
            )
        })
        afterAll(async () => {
            await cleanUpMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                fakeCircuitsData.fakeCircuitSmallNoContributors.uid
            )
            await cleanUpMockParticipant(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid, users[0].uid)
        })
    })

    describe("resumeContributionAfterTimeoutExpiration", () => {
        beforeAll(async () => {
            // create ceremony
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed,
                fakeCircuitsData.fakeCircuitSmallNoContributors
            )
            // create timed out contribution
            const participantContributing = generateFakeParticipant({
                uid: users[0].uid,
                data: {
                    userId: users[0].uid,
                    contributionProgress: 1,
                    contributionStep: ParticipantContributionStep.COMPUTING,
                    status: ParticipantStatus.EXHUMED,
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
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                users[0].uid,
                participantContributing
            )

            // create a contriution/participant not in EXUMHED stage
            const participantNotExumhed = generateFakeParticipant({
                uid: users[2].uid,
                data: {
                    userId: users[2].uid,
                    contributionProgress: 1,
                    contributionStep: ParticipantContributionStep.COMPUTING,
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
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                users[2].uid,
                participantNotExumhed
            )
        })
        it("should not work when not authenticated", async () => {
            await signOut(userAuth)
            assert.isRejected(
                resumeContributionAfterTimeoutExpiration(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            )
        })
        it("should revert when given a non existent ceremony id", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            assert.isRejected(resumeContributionAfterTimeoutExpiration(userFunctions, "notExistentId"))
        })
        it("should revert when the user is not a participant", async () => {
            // log in to a user which is not a participant
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            assert.isRejected(
                resumeContributionAfterTimeoutExpiration(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            )
        })
        it("should revert when the user is not in the EXHUMED state", async () => {
            // sign in with user 2
            await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
            assert.isRejected(
                resumeContributionAfterTimeoutExpiration(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            )
        })
        it.skip("should succesfully resume the contribution", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            expect(
                await resumeContributionAfterTimeoutExpiration(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid
                )
            ).to.not.be.rejected
        })
        afterAll(async () => {
            await cleanUpMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                fakeCircuitsData.fakeCircuitSmallNoContributors.uid
            )
            await cleanUpMockParticipant(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid, users[0].uid)
            await cleanUpMockParticipant(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid, users[2].uid)
        })
    })

    describe("progressToNextContributionStep", () => {
        beforeAll(async () => {
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed,
                fakeCircuitsData.fakeCircuitSmallNoContributors
            )
            // store participant in DOWNLOADING state
            const participantContributing = generateFakeParticipant({
                uid: users[1].uid,
                data: {
                    userId: users[1].uid,
                    contributionProgress: 1,
                    contributionStep: ParticipantContributionStep.DOWNLOADING,
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
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                users[1].uid,
                participantContributing
            )

            const participantContributingReady = generateFakeParticipant({
                uid: users[0].uid,
                data: {
                    userId: users[0].uid,
                    contributionProgress: 1,
                    contributionStep: ParticipantContributionStep.DOWNLOADING,
                    status: ParticipantStatus.READY,
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
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                users[0].uid,
                participantContributingReady
            )

            // create closed ceremony
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyClosedDynamic,
                fakeCircuitsData.fakeCircuitSmallNoContributors
            )
        })
        it("should revert when the user is not in the CONTRIBUTING state", async () => {
            // sign in with user 0
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            assert.isRejected(
                progressToNextContributionStep(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            )
        })
        it("should revert when called by a user which did not contribute to this ceremony", async () => {
            // sign in with user 2
            await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
            assert.isRejected(
                progressToNextContributionStep(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            )
        })
        it("should revert when the ceremony is not open", async () => {
            // sign in with user 1
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            assert.isRejected(
                progressToNextContributionStep(userFunctions, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid)
            )
        })
        it("should change from DOWNLOADING to COMPUTING", async () => {
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            await progressToNextContributionStep(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            const participantDocument = await adminFirestore
                .collection(getParticipantsCollectionPath(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid))
                .doc(users[1].uid)
                .get()
            const participantData = participantDocument.data()
            expect(participantData?.contributionStep).to.equal(ParticipantContributionStep.COMPUTING)
        })
        it("should change from COMPUTING to UPLOADING", async () => {
            await progressToNextContributionStep(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            const participantDocument = await adminFirestore
                .collection(getParticipantsCollectionPath(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid))
                .doc(users[1].uid)
                .get()
            const participantData = participantDocument.data()
            expect(participantData?.contributionStep).to.equal(ParticipantContributionStep.UPLOADING)
        })
        it("should change from UPLOADING to VERIFYING", async () => {
            await progressToNextContributionStep(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            const participantDocument = await adminFirestore
                .collection(getParticipantsCollectionPath(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid))
                .doc(users[1].uid)
                .get()
            const participantData = participantDocument.data()
            expect(participantData?.contributionStep).to.equal(ParticipantContributionStep.VERIFYING)
        })
        it("should change from VERIFYING to COMPLETED", async () => {
            await progressToNextContributionStep(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            const participantDocument = await adminFirestore
                .collection(getParticipantsCollectionPath(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid))
                .doc(users[1].uid)
                .get()
            const participantData = participantDocument.data()
            expect(participantData?.contributionStep).to.equal(ParticipantContributionStep.COMPLETED)
        })
        it("should revert when the user is not authenticated", async () => {
            await signOut(userAuth)
            assert.isRejected(
                progressToNextContributionStep(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            )
        })
        it("should revert when given a non existent ceremony id", async () => {
            // sign in with user 1
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            assert.isRejected(progressToNextContributionStep(userFunctions, "notExistentId"))
        })
        afterAll(async () => {
            await cleanUpMockParticipant(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid, users[0].uid)
            await cleanUpMockParticipant(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid, users[1].uid)
            await cleanUpMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                fakeCircuitsData.fakeCircuitSmallNoContributors.uid
            )
            await cleanUpMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
                fakeCircuitsData.fakeCircuitSmallNoContributors.uid
            )
        })
    })

    // if we have the url for the cloud function, we can test it
    if (process.env.FIREBASE_CF_URL_VERIFY_CONTRIBUTION) {
        describe("verifyContribution", () => {
            const bucketName = "test-bucket"
            beforeAll(async () => {})
            it("should revert when the user is not authenticated", async () => {
                await signOut(userAuth)
                assert.isRejected(
                    verifyContribution(
                        userFunctions,
                        process.env.FIREBASE_CF_URL_VERIFY_CONTRIBUTION!,
                        fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                        fakeCircuitsData.fakeCircuitSmallContributors.uid,
                        "contributor",
                        bucketName
                    )
                )
            })
            it("should revert when given a non existent ceremony id", async () => {
                await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
                assert.isRejected(
                    verifyContribution(
                        userFunctions,
                        process.env.FIREBASE_CF_URL_VERIFY_CONTRIBUTION!,
                        "notExistentId",
                        fakeCircuitsData.fakeCircuitSmallContributors.uid,
                        "contributor",
                        bucketName
                    )
                )
            })
            it.skip("should revert when given a non existent circuit id", async () => {
                await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
                assert.isRejected(
                    verifyContribution(
                        userFunctions,
                        process.env.FIREBASE_CF_URL_VERIFY_CONTRIBUTION!,
                        fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                        "notExistentId",
                        "contributor",
                        bucketName
                    )
                )
            })
            it("should revert when called by a user which did not contribute to this ceremony", async () => {
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                assert.isRejected(
                    verifyContribution(
                        userFunctions,
                        process.env.FIREBASE_CF_URL_VERIFY_CONTRIBUTION!,
                        fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                        fakeCircuitsData.fakeCircuitSmallContributors.uid,
                        "contributor",
                        bucketName
                    )
                )
            })
            it("should store the contribution verification result", async () => {})
            it("should allow a coordinator to finalize a ceremony if in state CLOSED", async () => {})
            it("should return valid=false if the participant is not in the CONTRIBUTING stage", async () => {})
            it("should revert if there is more than one contribution without a doc link", async () => {})
        })
    }

    describe("temporaryStoreCurrentContributionMultiPartUploadId", () => {
        beforeAll(async () => {
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed,
                fakeCircuitsData.fakeCircuitSmallNoContributors
            )
        })

        it("should revert when given a non existent ceremony id", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            assert.isRejected(
                temporaryStoreCurrentContributionMultiPartUploadId(userFunctions, "notExistentId", "uploadId")
            )
        })
        it("should revert when the user is not authenticated", async () => {
            await signOut(userAuth)
            assert.isRejected(
                temporaryStoreCurrentContributionMultiPartUploadId(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    "uploadId"
                )
            )
        })
        it("should revert when called by a user which did not contribute to this ceremony", async () => {
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            assert.isRejected(
                temporaryStoreCurrentContributionMultiPartUploadId(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    "uploadId"
                )
            )
        })
        it("should revert when the calling user has not reached the upload step", async () => {})
        it("should successfully store the upload id", async () => {})
    })

    describe("temporaryStoreCurrentContributionUploadedChunkData", () => {
        beforeAll(async () => {
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed,
                fakeCircuitsData.fakeCircuitSmallNoContributors
            )
            const newParticipant = generateFakeParticipant({
                uid: users[0].uid,
                data: {
                    userId: users[0].uid,
                    contributionProgress: 1,
                    contributionStep: ParticipantContributionStep.UPLOADING,
                    status: ParticipantStatus.READY,
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
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                users[0].uid,
                newParticipant
            )
        })
        it("should revert when the user is not authenticated", async () => {
            await signOut(userAuth)
            assert.isRejected(
                temporaryStoreCurrentContributionUploadedChunkData(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    "chunkData",
                    1
                )
            )
        })
        it("should revert when given a non existent ceremony id", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            assert.isRejected(
                temporaryStoreCurrentContributionUploadedChunkData(userFunctions, "notExistentId", "chunkData", 1)
            )
        })
        it("should revert when called by a user which is not a participant to this ceremony", async () => {
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            assert.isRejected(
                temporaryStoreCurrentContributionUploadedChunkData(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    "chunkData",
                    1
                )
            )
        })
        it("should revert when called by a user which has not reached the upload step", async () => {})
        it("should successfully store the chunk data", async () => {})
        afterAll(async () => {
            await cleanUpMockParticipant(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid, users[0].uid)
            await cleanUpMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                fakeCircuitsData.fakeCircuitSmallNoContributors.uid
            )
        })
    })

    afterAll(async () => {
        // Clean user from DB.
        await cleanUpMockUsers(adminAuth, adminFirestore, users)
        // Delete admin app.
        await deleteAdminApp()
    })
})
