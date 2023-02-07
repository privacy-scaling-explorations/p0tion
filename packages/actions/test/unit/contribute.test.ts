import chai, { assert, expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth"
import { Timestamp } from "firebase/firestore"
import { fakeCeremoniesData, fakeUsersData } from "../data/samples"
import {
    checkParticipantForCeremony,
    commonTerms,
    convertToGB,
    getCeremonyCircuits,
    getNextCircuitForContribution,
    getOpenedCeremonies,
    getParticipantsCollectionPath,
    getZkeysSpaceRequirementsForContributionInGB,
    makeProgressToNextContribution,
    permanentlyStoreCurrentContributionTimeAndHash
} from "../../src"
import {
    cleanUpMockCeremony,
    cleanUpMockUsers,
    createMockCeremony,
    createMockUser,
    deleteAdminApp,
    generateUserPasswords,
    initializeAdminServices,
    initializeUserServices,
    setCustomClaims,
    sleep
} from "../utils"
import { ParticipantStatus } from "../../src/types/enums"

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
    const userUids: string[] = []
    const passwords = generateUserPasswords(3)

    // setup - create few users and a mock ceremony
    beforeAll(async () => {
        // create users
        for (let i = 0; i < passwords.length; i++) {
            userUids.push(
                await createMockUser(
                    userApp,
                    users[i].data.email,
                    passwords[i],
                    i === passwords.length - 1,
                    adminAuth
                )
            )
        }
        // set coordinator (user3)
        await setCustomClaims(adminAuth, userUids[2], { coordinator: true })
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
        it("should fail when not authenticated", async () => {
            await signOut(userAuth)
            assert.isRejected(getOpenedCeremonies(userFirestore))
        })
        it.skip("should return an empty array when no ceremonies are open", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const ceremonies = await getOpenedCeremonies(userFirestore)
            expect(ceremonies.length).to.be.eq(0)
        })
        it.skip("should allow to retrieve all opened ceremonies", async () => {
            // create ceremony
            await createMockCeremony(adminFirestore)
            // auth
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const ceremonies = await getOpenedCeremonies(userFirestore)
            expect(ceremonies.length).to.be.gt(0)
        })
        afterAll(async () => {
            await cleanUpMockCeremony(adminFirestore)
        })
    })

    describe("getCeremonyCircuits", () => {
        beforeAll(async () => {
            await createMockCeremony(adminFirestore)
        })
        it("should fail when not authenticated", async () => {
            await signOut(userAuth)
            assert.isRejected(getCeremonyCircuits(userFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid))
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
        it("should revert when given the wrong firebase db arguement", async () => {
            // auth
            assert.isRejected(getCeremonyCircuits({} as any, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid))
        })
        afterAll(async () => {
            await cleanUpMockCeremony(adminFirestore)
        })
    })

    describe("getNextCircuitForContribution", () => {
        beforeAll(async () => {
            await createMockCeremony(adminFirestore)
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
        afterAll(async () => {
            cleanUpMockCeremony(adminFirestore)
        })
    })

    describe("checkParticipantForCeremony", () => {
        beforeAll(async () => {
            // create open ceremony
            await createMockCeremony(adminFirestore)
            // create closed ceremony
            await createMockCeremony(adminFirestore, fakeCeremoniesData.fakeCeremonyClosedDynamic)
        })
        it("should revert when not authenticated", async () => {
            await signOut(userAuth)
            assert.isRejected(
                checkParticipantForCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            )
        })
        it("should revert when providing an invalid ceremonyId", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            assert.isRejected(checkParticipantForCeremony(userFunctions, "notExistentId"))
        })
        it("should revert when passing the ID of a non open ceremony", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            assert.isRejected(
                checkParticipantForCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid)
            )
        })
        it.skip("should return false when the user is locked", async () => {
            // @todo figure out how to bypass changes made by the cloud function
            // coordinateCeremony
            const ceremonyId = fakeCeremoniesData.fakeCeremonyOpenedFixed.uid
            // use user 2
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            // const doc = await adminFirestore
            //     .collection(getParticipantsCollectionPath(ceremonyId))
            //     .doc(userUids[1])
            //     .get()
            // lock user
            adminFirestore
                .collection(getParticipantsCollectionPath(ceremonyId))
                .doc(userUids[1])
                .set({
                    status: ParticipantStatus.CONTRIBUTING,
                    contributionProgress: 0,
                    contributions: [],
                    lastUpdated: Timestamp.now().toMillis() - 600
                })
            const newDoc = await adminFirestore
                .collection(getParticipantsCollectionPath(ceremonyId))
                .doc(userUids[1])
                .get()
            console.log("data", newDoc.data())
            const result = await checkParticipantForCeremony(userFunctions, ceremonyId)
            expect(result).to.be.false
        })
        it.skip("should return true when the user calling the function is allowed to contribute", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const result = await checkParticipantForCeremony(
                userFunctions,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid
            )
            expect(result).to.be.true
        })
        it("should revert when given an invalid firebase function argument", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            assert.isRejected(checkParticipantForCeremony({} as any, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid))
        })
        afterAll(async () => {
            await cleanUpMockCeremony(adminFirestore)
            await cleanUpMockCeremony(adminFirestore, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid)
        })
    })
    describe("permanentlyStoreCurrentContributionTimeAndHash", () => {
        beforeAll(async () => {
            // mock a ceremony
            await createMockCeremony(adminFirestore)

            // mock a contribution with user 0
            await sleep(10000)
        })
        // @todo why does this test fail?
        it.skip("should store the contribution time and hash", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const doc = await adminFirestore
                .collection(commonTerms.collections.ceremonies.name)
                .doc(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
                .get()

            console.log("exists", doc.exists)
            console.log("uid", fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            expect(
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
            assert.isRejected(
                permanentlyStoreCurrentContributionTimeAndHash(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    new Date().valueOf(),
                    "contributionHash"
                )
            )
        })
        it("should revert when providing an invalid ceremonyId", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            assert.isRejected(
                permanentlyStoreCurrentContributionTimeAndHash(
                    userFunctions,
                    "notExistentId",
                    new Date().valueOf(),
                    "contributionHash"
                )
            )
        })
        it("should revert when calling with a user that did not contribute", async () => {
            await signOut(userAuth)
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            assert.isRejected(
                permanentlyStoreCurrentContributionTimeAndHash(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    new Date().valueOf(),
                    "contributionHash"
                )
            )
        })
        afterAll(async () => {
            await cleanUpMockCeremony(adminFirestore)
        })
    })
    describe("makeProgressToNextContribution", () => {
        beforeAll(async () => {
            // mock a ceremony
            await createMockCeremony(adminFirestore)
        })
        it("should fail when not authenticated", async () => {
            await signOut(userAuth)
            assert.isRejected(
                makeProgressToNextContribution(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            )
        })
        it("should progress the next contribution for the logged in user", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            expect(makeProgressToNextContribution(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)).to.not
                .be.rejected
        })
        it("should revert when providing an invalid ceremonyId", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            assert.isRejected(makeProgressToNextContribution(userFunctions, "notExistentId"))
        })
        it("should revert when the user has not contribute yet", async () => {
            await signOut(userAuth)
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            assert.isRejected(
                makeProgressToNextContribution(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            )
        })
    })

    afterAll(async () => {
        // Clean user from DB.
        await cleanUpMockUsers(adminAuth, adminFirestore, userUids)

        // Clean up ceremonies data
        await cleanUpMockCeremony(adminFirestore)

        // Delete admin app.
        await deleteAdminApp()
    })
})
