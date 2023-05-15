import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth"
import { where } from "firebase/firestore"
import { fakeCeremoniesData, fakeCircuitsData, fakeParticipantsData, fakeUsersData } from "../data/samples"
import {
    getCurrentFirebaseAuthUser,
    queryCollection,
    fromQueryToFirebaseDocumentInfo,
    getAllCollectionDocs,
    getCircuitContributionsFromContributor,
    getDocumentById,
    getCurrentActiveParticipantTimeout,
    getClosedCeremonies,
    getParticipantsCollectionPath,
    getCircuitsCollectionPath,
    getContributionsCollectionPath,
    getTimeoutsCollectionPath,
    commonTerms
} from "../../src/index"
import {
    deleteAdminApp,
    initializeAdminServices,
    initializeUserServices,
    cleanUpRecursively,
    generateUserPasswords,
    createMockUser,
    createMockCeremony,
    cleanUpMockUsers,
    sleep,
    mockCeremoniesCleanup
} from "../utils/index"
import { CeremonyState } from "../../src/types/enums"

chai.use(chaiAsPromised)

/**
 * Unit test for Firebase helpers.
 * @notice some of these methods are used as a core component for authentication.
 */
describe("Database", () => {
    // Init firebase services.
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp, userFirestore } = initializeUserServices()
    const userAuth = getAuth(userApp)

    // Generate users.
    const users = [fakeUsersData.fakeUser1, fakeUsersData.fakeUser2]
    const passwords = generateUserPasswords(users.length)

    beforeAll(async () => {
        for (let i = 0; i < users.length; i++) {
            const uid = await createMockUser(
                userApp,
                users[i].data.email,
                passwords[i],
                i === users.length - 1,
                adminAuth
            )
            users[i].uid = uid
            await sleep(500)
        }

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
    })

    describe("queryCollection", () => {
        it("should not allow the coordinator to query the users collection", async () => {
            // sign in as a coordinator
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            const currentAuthenticatedCoordinator = getCurrentFirebaseAuthUser(userApp)
            // refresh target
            await currentAuthenticatedCoordinator.getIdToken(true)
            await expect(
                queryCollection(userFirestore, commonTerms.collections.users.name, [
                    where(commonTerms.collections.users.fields.email, "==", users[1].data.email)
                ])
            ).to.be.rejected
        })
        it("should allow any authenticated user to query the ceremonies collection", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const query = await queryCollection(userFirestore, commonTerms.collections.ceremonies.name, [
                where(commonTerms.collections.ceremonies.fields.state, "==", CeremonyState.OPENED)
            ])
            expect(query.docs.length).to.be.gt(0)
        })
    })

    describe("getAllCollectionDocs", () => {
        it("should not allow the coordinator to query all the users collection", async () => {
            // sign in as a coordinator
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            await expect(getAllCollectionDocs(userFirestore, commonTerms.collections.users.name)).to.be.rejected
        })
        it("should revert when a non coordinator tries to query the users collection", async () => {
            // sign in as a participant
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            await expect(getAllCollectionDocs(userFirestore, commonTerms.collections.users.name)).to.be.rejected
        })
        it("should allow any authenticated user to query the ceremonies collection", async () => {
            // Sign in as coordinator.
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            const collection = await getAllCollectionDocs(userFirestore, commonTerms.collections.ceremonies.name)
            expect(collection.length).to.be.gt(0)
        })
    })

    describe("fromQueryToFirebaseDocumentInfo", () => {
        it("should return data for a valid collection", async () => {
            // sign in as a coordinator
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            const collection = await getAllCollectionDocs(userFirestore, commonTerms.collections.ceremonies.name)
            expect(collection.length).to.be.gt(0)
            const collectionInfo = fromQueryToFirebaseDocumentInfo(collection)
            expect(collectionInfo).to.not.be.null
        })
        it("should not return any data when given an empty collection", async () => {
            const collectionInfo = fromQueryToFirebaseDocumentInfo([] as any)
            expect(collectionInfo.length).to.be.eq(0)
        })
    })

    describe("getDocumentById", () => {
        it("should allow an authenticated user to get a document with their own data", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const userDoc = await getDocumentById(userFirestore, commonTerms.collections.users.name, users[0].uid)
            expect(userDoc).to.not.be.null
        })
        it("should revert when not logged in", async () => {
            await signOut(userAuth)
            await expect(getDocumentById(userFirestore, commonTerms.collections.users.name, users[0].uid)).to.be
                .rejected
        })
        it("should an authenticated user to get a ceremony document", async () => {
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const userDoc = await getDocumentById(
                userFirestore,
                commonTerms.collections.ceremonies.name,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid
            )
            expect(userDoc).to.not.be.null
        })
    })

    describe("getCircuitContributionsFromContributor", () => {
        it("should return an empty array when a ceremony has not participants", async () => {
            const contributions = await getCircuitContributionsFromContributor(
                userFirestore,
                fakeCircuitsData.fakeCircuitSmallNoContributors.uid,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                users[0].uid
            )
            expect(contributions.length).to.be.eq(0)
        })
        // @todo add more tests when testing contributions
    })

    describe("getClosedCeremonies", () => {
        it("should return all closed ceremonies", async () => {
            const closedCeremonies = await getClosedCeremonies(userFirestore)
            expect(closedCeremonies.length).to.be.gt(0)
        })
        it("should not return any closed ceremonies after removing the data from the db", async () => {
            // here we delete the circuit and the ceremony so we run this test last
            await cleanUpRecursively(adminFirestore, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid)

            const closedCeremonies = await getClosedCeremonies(userFirestore)
            expect(closedCeremonies.length).to.be.equal(0)
        })
    })

    describe("getCurrentActiveParticipantTimeout", () => {
        // @todo add more tests when testing contibution
        it("should return an empty array when querying a ceremony's circuits without contributors", async () => {
            const timeout = await getCurrentActiveParticipantTimeout(
                userFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                users[0].uid
            )
            expect(timeout.length).to.be.eq(0)
        })
    })

    describe("getParticipantsCollectionPath", () => {
        it("should return the correct participants collection path", () => {
            const path = getParticipantsCollectionPath(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            expect(path).to.be.eq(`ceremonies/${fakeCeremoniesData.fakeCeremonyOpenedFixed.uid}/participants`)
        })
    })

    describe("getCircuitsCollectionPath", () => {
        it("should return the correct circuits collection path", () => {
            const path = getCircuitsCollectionPath(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            expect(path).to.be.eq(`ceremonies/${fakeCeremoniesData.fakeCeremonyOpenedFixed.uid}/circuits`)
        })
    })

    describe("getContributionsCollectionPath", () => {
        it("should return the correct contributions collection path", () => {
            const path = getContributionsCollectionPath(
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                fakeCircuitsData.fakeCircuitSmallContributors.uid
            )
            expect(path).to.be.eq(
                `ceremonies/${fakeCeremoniesData.fakeCeremonyOpenedFixed.uid}/circuits/${fakeCircuitsData.fakeCircuitSmallContributors.uid}/contributions`
            )
        })
    })

    describe("getTimeoutsCollectionPath", () => {
        it("should return the correct timeouts collection path", () => {
            const path = getTimeoutsCollectionPath(
                fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                fakeParticipantsData.fakeParticipantCurrentContributorStepOne.uid
            )
            expect(path).to.be.eq(
                `ceremonies/${fakeCeremoniesData.fakeCeremonyOpenedFixed.uid}/participants/${fakeParticipantsData.fakeParticipantCurrentContributorStepOne.uid}/timeouts`
            )
        })
    })

    afterAll(async () => {
        await cleanUpMockUsers(adminAuth, adminFirestore, users)
        await mockCeremoniesCleanup(adminFirestore)

        // Delete admin app.
        await deleteAdminApp()
    })
})
