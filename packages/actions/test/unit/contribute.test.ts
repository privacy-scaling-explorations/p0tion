import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth"
import { DocumentData, DocumentSnapshot } from "firebase/firestore"
import { ETagWithPartNumber } from "../../src/types/index"
import {
    fakeCeremoniesData,
    fakeCircuitsData,
    fakeContributions,
    fakeParticipantsData,
    fakeUsersData
} from "../data/samples"
import {
    checkParticipantForCeremony,
    getCeremonyCircuits,
    getCircuitBySequencePosition,
    getOpenedCeremonies,
    permanentlyStoreCurrentContributionTimeAndHash,
    progressToNextContributionStep,
    resumeContributionAfterTimeoutExpiration,
    verifyContribution,
    temporaryStoreCurrentContributionMultiPartUploadId,
    temporaryStoreCurrentContributionUploadedChunkData,
    getParticipantsCollectionPath,
    convertBytesOrKbToGb,
    getPublicAttestationPreambleForContributor,
    getContributionsValidityForContributor,
    getDocumentById,
    getCircuitsCollectionPath
} from "../../src/index"
import {
    cleanUpMockUsers,
    createMockCeremony,
    createMockUser,
    createMockTimedOutContribution,
    deleteAdminApp,
    generateUserPasswords,
    initializeAdminServices,
    initializeUserServices,
    sleep,
    createMockParticipant,
    envType,
    createMockContribution,
    cleanUpRecursively,
    mockCeremoniesCleanup
} from "../utils/index"
import { generateFakeParticipant } from "../data/generators"
import { ParticipantContributionStep, ParticipantStatus, TestingEnvironment } from "../../src/types/enums"

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

    describe("convertBytesOrKbToGb", () => {
        it("should convert bytes to GB correctly", () => {
            expect(convertBytesOrKbToGb(1000000000, true)).to.equal(0.9313225746154785)
            expect(convertBytesOrKbToGb(1000000000, false)).to.equal(953.67431640625)
        })
    })

    describe("getOpenedCeremonies", () => {
        it.skip("should return an empty array when no ceremonies are open", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const ceremonies = await getOpenedCeremonies(userFirestore)
            expect(ceremonies.length).to.be.eq(0)
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
            await sleep(2000)
            const ceremonies2 = await getOpenedCeremonies(userFirestore)
            expect(ceremonies2).to.deep.equal(ceremonies)
        })
        /// @note running on emulator gives a different error
        if (envType === TestingEnvironment.PRODUCTION) {
            it("should succeed when not authenticated", async () => {
                await signOut(userAuth)
                await expect(getOpenedCeremonies(userFirestore)).to.be.fulfilled
            })
        }
        afterAll(async () => {
            await cleanUpRecursively(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
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
        afterAll(async () => {
            await cleanUpRecursively(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
        })
    })

    describe("getCircuitBySequencePosition", () => {
        beforeAll(async () => {
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed,
                fakeCircuitsData.fakeCircuitSmallNoContributors
            )
        })
        it("should revert when there are no circuits to contribute to", async () => {
            const position = 500
            const circuits = await getCeremonyCircuits(userFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            expect(() => getCircuitBySequencePosition(circuits, position)).to.throw(
                `Unable to find the circuit having position ${position}. Run the command again and, if this error persists please contact the coordinator.`
            )
        })
        it("should return the next circuit for contribution", async () => {
            const circuits = await getCeremonyCircuits(userFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            const nextCircuit = getCircuitBySequencePosition(circuits, 1)
            expect(nextCircuit).to.not.be.null
        })
        it("should revert when passing an empty Circuit object", () => {
            const position = 1
            expect(() => getCircuitBySequencePosition([], position)).to.throw(
                `Unable to find the circuit having position ${position}. Run the command again and, if this error persists please contact the coordinator.`
            )
        })
        afterAll(async () => {
            await cleanUpRecursively(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
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
        it("should revert when providing an invalid ceremonyId", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await expect(checkParticipantForCeremony(userFunctions, "notExistentId")).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
            )
        })
        it("should revert when passing the ID of a non open ceremony", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await expect(
                checkParticipantForCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid)
            ).to.be.rejectedWith(
                "Unable to progress to next contribution step." // SE_PARTICIPANT_CEREMONY_NOT_OPENED
            )
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
        it("should revert when not authenticated", async () => {
            await signOut(userAuth)
            await expect(
                checkParticipantForCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            ).to.be.rejectedWith("Unable to retrieve the authenticated user")
        })
        afterAll(async () => {
            await cleanUpRecursively(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            await cleanUpRecursively(adminFirestore, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid)
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
        afterAll(async () => {
            await cleanUpRecursively(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
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
        it("should revert when given a non existent ceremony id", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await expect(resumeContributionAfterTimeoutExpiration(userFunctions, "notExistentId")).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
            )
        })
        it("should revert when the user is not a participant", async () => {
            // log in to a user which is not a participant
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            await expect(
                resumeContributionAfterTimeoutExpiration(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            ).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
            )
        })
        it("should revert when the user is not in the EXHUMED state", async () => {
            // sign in with user 2
            await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
            await expect(
                resumeContributionAfterTimeoutExpiration(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            ).to.be.rejectedWith("Unable to progress to next circuit for contribution")
        })
        it("should succesfully resume the contribution", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await expect(
                resumeContributionAfterTimeoutExpiration(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            ).to.not.be.rejected
        })
        it("should not work when not authenticated", async () => {
            await signOut(userAuth)
            await expect(
                resumeContributionAfterTimeoutExpiration(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            ).to.be.rejectedWith("Unable to retrieve the authenticated user.")
        })
        afterAll(async () => {
            await cleanUpRecursively(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
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
                uid: users[2].uid,
                data: {
                    userId: users[2].uid,
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
                users[2].uid,
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
            // sign in with user 2
            await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
            await expect(
                progressToNextContributionStep(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            ).to.be.rejectedWith("Unable to progress to next contribution step.")
        })
        it("should revert when called by a user which did not contribute to this ceremony", async () => {
            // sign in with user 2
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await expect(
                progressToNextContributionStep(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            ).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
            )
        })
        /// @todo check if this should be more like: "Ceremony is not open"
        it("should revert when the ceremony is not open", async () => {
            // sign in with user 1
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            await expect(
                progressToNextContributionStep(userFunctions, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid)
            ).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
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
        it("should revert when given a non existent ceremony id", async () => {
            // sign in with user 1
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            await expect(progressToNextContributionStep(userFunctions, "notExistentId")).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
            )
        })
        it("should revert when the user is not authenticated", async () => {
            await signOut(userAuth)
            await expect(
                progressToNextContributionStep(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            ).to.be.rejectedWith("Unable to retrieve the authenticated user.")
        })
        afterAll(async () => {
            await cleanUpRecursively(adminFirestore, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid)
            await cleanUpRecursively(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
        })
    })

    // if we have the url for the cloud function, we can test it
    if (envType === TestingEnvironment.PRODUCTION) {
        /// @todo update error messages after refactoring
        describe("verifyContribution", () => {
            const bucketName = "test-bucket"
            beforeAll(async () => {
                await createMockCeremony(
                    adminFirestore,
                    fakeCeremoniesData.fakeCeremonyContributeTest,
                    fakeCircuitsData.fakeCircuitSmallContributors
                )
            })
            it("should revert when the user is not authenticated", async () => {
                const circuitDocument = await getDocumentById(
                    userFirestore,
                    getCircuitsCollectionPath(fakeCeremoniesData.fakeCeremonyContributeTest.uid),
                    fakeCircuitsData.fakeCircuitSmallContributors.uid
                )

                await signOut(userAuth)

                await expect(
                    verifyContribution(
                        userFunctions,
                        fakeCeremoniesData.fakeCeremonyContributeTest.uid,
                        circuitDocument,
                        bucketName,
                        "contributor",
                        process.env.FIREBASE_CF_URL_VERIFY_CONTRIBUTION!
                    )
                ).to.be.rejectedWith("Unable to retrieve the authenticated user.")
            })
            it("should revert when given a non existent ceremony id", async () => {
                await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])

                const circuitDocument = await getDocumentById(
                    userFirestore,
                    getCircuitsCollectionPath(fakeCeremoniesData.fakeCeremonyContributeTest.uid),
                    fakeCircuitsData.fakeCircuitSmallContributors.uid
                )

                await expect(
                    verifyContribution(
                        userFunctions,
                        "notExistentId",
                        circuitDocument,
                        bucketName,
                        "contributor",
                        process.env.FIREBASE_CF_URL_VERIFY_CONTRIBUTION!
                    )
                ).to.be.rejectedWith(
                    "Unable to find a document with the given identifier for the provided collection path."
                )
            })
            it("should revert when given a non existent circuit id", async () => {
                await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])

                await expect(
                    verifyContribution(
                        userFunctions,
                        fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                        {} as DocumentSnapshot<DocumentData>,
                        bucketName,
                        "contributor",
                        process.env.FIREBASE_CF_URL_VERIFY_CONTRIBUTION!
                    )
                ).to.be.rejectedWith("Unable to perform the operation due to incomplete or incorrect data.")
            })
            it("should revert when called by a user which did not contribute to this ceremony", async () => {
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])

                const circuitDocument = await getDocumentById(
                    userFirestore,
                    getCircuitsCollectionPath(fakeCeremoniesData.fakeCeremonyContributeTest.uid),
                    fakeCircuitsData.fakeCircuitSmallContributors.uid
                )

                await expect(
                    verifyContribution(
                        userFunctions,
                        fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                        circuitDocument,
                        bucketName,
                        "contributor",
                        process.env.FIREBASE_CF_URL_VERIFY_CONTRIBUTION!
                    )
                ).to.be.rejectedWith(
                    "Unable to find a document with the given identifier for the provided collection path."
                )
            })
            it("should store the contribution verification result", async () => {})
            afterAll(async () => {
                await cleanUpRecursively(adminFirestore, fakeCeremoniesData.fakeCeremonyContributeTest.uid)
            })
        })
    }

    describe("temporaryStoreCurrentContributionMultiPartUploadId", () => {
        beforeAll(async () => {
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed,
                fakeCircuitsData.fakeCircuitSmallNoContributors
            )

            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedDynamic,
                fakeCircuitsData.fakeCircuitSmallNoContributors
            )

            await createMockParticipant(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedDynamic.uid,
                users[0].uid,
                fakeParticipantsData.fakeParticipantCurrentContributorStepOne
            )

            await createMockParticipant(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedDynamic.uid,
                users[1].uid,
                fakeParticipantsData.fakeParticipantCurrentContributorUploading
            )

            await sleep(1000)
        })
        it("should revert when given a non existent ceremony id", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await expect(
                temporaryStoreCurrentContributionMultiPartUploadId(userFunctions, "notExistentId", "uploadId")
            ).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
            )
        })
        it("should revert when called by a user which did not contribute to this ceremony", async () => {
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            await expect(
                temporaryStoreCurrentContributionMultiPartUploadId(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    "uploadId"
                )
            ).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
            )
        })
        it("should revert when the calling user has not reached the upload step", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await expect(
                temporaryStoreCurrentContributionMultiPartUploadId(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedDynamic.uid,
                    "uploadId"
                )
            ).to.be.rejectedWith("Unable to store temporary data to resume a multi-part upload.")
        })
        it("should successfully store the upload id", async () => {
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            await expect(
                temporaryStoreCurrentContributionMultiPartUploadId(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedDynamic.uid,
                    "uploadId"
                )
            ).to.be.fulfilled
        })
        it("should revert when the user is not authenticated", async () => {
            await signOut(userAuth)
            await expect(
                temporaryStoreCurrentContributionMultiPartUploadId(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    "uploadId"
                )
            ).to.be.rejectedWith("Unable to retrieve the authenticated user.")
        })
        afterAll(async () => {
            await cleanUpRecursively(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            await cleanUpRecursively(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedDynamic.uid)
        })
    })

    describe("temporaryStoreCurrentContributionUploadedChunkData", () => {
        beforeAll(async () => {
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed,
                fakeCircuitsData.fakeCircuitSmallNoContributors
            )
            await createMockParticipant(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                users[2].uid,
                fakeParticipantsData.fakeParticipantCurrentContributorStepTwo
            )
            await createMockParticipant(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                users[1].uid,
                fakeParticipantsData.fakeParticipantCurrentContributorUploading
            )
        })
        it("should revert when given a non existent ceremony id", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await expect(
                temporaryStoreCurrentContributionUploadedChunkData(
                    userFunctions,
                    "notExistentId",
                    {} as ETagWithPartNumber
                )
            ).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
            )
        })
        it("should revert when called by a user which did not contribute to this ceremony", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await expect(
                temporaryStoreCurrentContributionUploadedChunkData(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    {} as ETagWithPartNumber
                )
            ).to.be.rejectedWith(
                "Unable to find a document with the given identifier for the provided collection path."
            )
        })
        it("should revert when called by a user which is not at the upload step of this contribution", async () => {
            await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
            await expect(
                temporaryStoreCurrentContributionUploadedChunkData(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    {} as ETagWithPartNumber
                )
            ).to.be.rejectedWith("Unable to store temporary data to resume a multi-part upload.")
        })
        it("should successfully store the chunk data", async () => {
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            await expect(
                temporaryStoreCurrentContributionUploadedChunkData(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    {} as ETagWithPartNumber
                )
            ).to.be.fulfilled
        })
        it("should revert when the user is not authenticated", async () => {
            await signOut(userAuth)
            await expect(
                temporaryStoreCurrentContributionUploadedChunkData(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    {} as ETagWithPartNumber
                )
            ).to.be.rejectedWith("Unable to retrieve the authenticated user.")
        })
        afterAll(async () => {
            await cleanUpRecursively(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
        })
    })

    describe("getContributionsValidityForContributor", () => {
        beforeAll(async () => {
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedDynamic,
                fakeCircuitsData.fakeCircuitSmallContributors
            )

            // @todo need rework.
            // delete when undefined.
            if (!fakeContributions.fakeContributionDone.data.beacon)
                delete fakeContributions.fakeContributionDone.data.beacon

            // user2 -> users[1]
            await createMockContribution(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedDynamic.uid,
                fakeCircuitsData.fakeCircuitSmallContributors.uid,
                fakeContributions.fakeContributionDone,
                fakeContributions.fakeContributionDone.uid
            )
        })
        it("should throw when given invalid data", async () => {
            const circuits = await getCeremonyCircuits(userFirestore, fakeCeremoniesData.fakeCeremonyOpenedDynamic.uid)
            await expect(
                getContributionsValidityForContributor(
                    userFirestore,
                    circuits,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    users[0].uid,
                    true
                )
            ).to.be.rejectedWith(
                "Unable to retrieve contributions for the participant. There may have occurred a database-side error. Please, we kindly ask you to terminate the current session and repeat the process"
            )
        })
        afterAll(async () => {
            await cleanUpRecursively(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedDynamic.uid)
        })
    })

    describe("getPublicAttestationPreambleForContributor", () => {
        it("should return the correct preamble for a contributor", () => {
            const preamble = getPublicAttestationPreambleForContributor(
                users[0].uid,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.data.prefix,
                false
            )
            expect(preamble).to.eq(
                `Hey, I'm ${users[0].uid} and I have contributed to the ${fakeCeremoniesData.fakeCeremonyOpenedFixed.data.prefix}.\nThe following are my contribution signatures:`
            )
        })
        it("should return the correct preamble for the final contribution", () => {
            const preamble = getPublicAttestationPreambleForContributor(
                users[0].uid,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.data.prefix,
                true
            )
            expect(preamble).to.eq(
                `Hey, I'm ${users[0].uid} and I have finalized the ${fakeCeremoniesData.fakeCeremonyOpenedFixed.data.prefix}.\nThe following are my contribution signatures:`
            )
        })
    })

    describe("generateValidContributionsAttestation", () => {})

    afterAll(async () => {
        // Clean user from DB.
        await cleanUpMockUsers(adminAuth, adminFirestore, users)
        // Clean up ceremonies
        await mockCeremoniesCleanup(adminFirestore)
        // Delete admin app.
        await deleteAdminApp()
    })
})
