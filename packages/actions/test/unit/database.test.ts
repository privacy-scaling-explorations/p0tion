import chai, { expect, assert } from "chai"
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
} from "../../src"
import {
    setCustomClaims,
    createNewFirebaseUserWithEmailAndPw,
    deleteAdminApp,
    generatePseudoRandomStringOfNumbers,
    initializeAdminServices,
    initializeUserServices,
    sleep,
    cleanUpRecursively
} from "../utils"
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

    // Sample data for running the test.
    const user = fakeUsersData.fakeUser2
    const coordinatorEmail = "coordinator@coordinator.com"
    // storing the uid so we can delete the user after the test
    let coordinatorUid: string

    // generate passwords for user and coordinator
    const userPwd = generatePseudoRandomStringOfNumbers(24)
    const coordinatorPwd = generatePseudoRandomStringOfNumbers(24)

    beforeAll(async () => {
        // create a new user without contributor privileges
        await createNewFirebaseUserWithEmailAndPw(userApp, user.data.email, userPwd)
        await sleep(5000)

        // Retrieve the current auth user in Firebase.
        const currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
        user.uid = currentAuthenticatedUser.uid

        // create account for coordinator
        await createNewFirebaseUserWithEmailAndPw(userApp, coordinatorEmail, coordinatorPwd)
        await sleep(5000)

        const currentAuthenticatedCoordinator = getCurrentFirebaseAuthUser(userApp)
        coordinatorUid = currentAuthenticatedCoordinator.uid

        // add custom claims for coordinator privileges
        await setCustomClaims(adminAuth, coordinatorUid, { coordinator: true })

        // Create the mock data on Firestore.
        await adminFirestore
            .collection(commonTerms.collections.ceremonies.name)
            .doc(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            .set({
                ...fakeCeremoniesData.fakeCeremonyOpenedFixed.data
            })

        await adminFirestore
            .collection(getCircuitsCollectionPath(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid))
            .doc(fakeCircuitsData.fakeCircuitSmallNoContributors.uid)
            .set({
                ...fakeCircuitsData.fakeCircuitSmallNoContributors.data
            })

        await adminFirestore
            .collection(commonTerms.collections.ceremonies.name)
            .doc(fakeCeremoniesData.fakeCeremonyClosedDynamic.uid)
            .set({
                ...fakeCeremoniesData.fakeCeremonyClosedDynamic.data
            })

        await adminFirestore
            .collection(getCircuitsCollectionPath(fakeCeremoniesData.fakeCeremonyClosedDynamic.uid))
            .doc(fakeCircuitsData.fakeCircuitSmallContributors.uid)
            .set({
                ...fakeCircuitsData.fakeCircuitSmallContributors.data
            })
    })

    describe("queryCollection", () => {
        it("should not allow the coordinator to query the users collection", async () => {
            // sign in as a coordinator
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
            await setCustomClaims(adminAuth, coordinatorUid, { coordinator: true })
            const currentAuthenticatedCoordinator = getCurrentFirebaseAuthUser(userApp)
            // refresh target
            await currentAuthenticatedCoordinator.getIdToken(true)
            assert.isRejected(
                queryCollection(userFirestore, commonTerms.collections.users.name, [
                    where(commonTerms.collections.users.fields.email, "==", user.data.email)
                ])
            )
        })
        it("should allow any authenticated user to query the ceremonies collection", async () => {
            // Sign in as coordinator.
            await signInWithEmailAndPassword(userAuth, user.data.email, userPwd)
            const query = await queryCollection(userFirestore, commonTerms.collections.ceremonies.name, [
                where(commonTerms.collections.ceremonies.fields.state, "==", CeremonyState.OPENED)
            ])
            expect(query.docs.length).to.be.gt(0)
        })
        it("should revert when not logged in", async () => {
            await signOut(userAuth)
            assert.isRejected(
                queryCollection(userFirestore, commonTerms.collections.ceremonies.name, [
                    where(commonTerms.collections.ceremonies.fields.state, "==", CeremonyState.OPENED)
                ])
            )
        })
    })

    describe("getAllCollectionDocs", () => {
        it("should not allow the coordinator to query all the users collection", async () => {
            // sign in as a coordinator
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
            assert.isRejected(getAllCollectionDocs(userFirestore, commonTerms.collections.users.name))
        })
        it("should revert when a non coordinator tries to query the users collection", async () => {
            // sign in as a participant
            await signInWithEmailAndPassword(userAuth, user.data.email, userPwd)
            assert.isRejected(getAllCollectionDocs(userFirestore, commonTerms.collections.users.name))
        })
        it("should allow any authenticated user to query the ceremonies collection", async () => {
            // Sign in as coordinator.
            await signInWithEmailAndPassword(userAuth, user.data.email, userPwd)
            const collection = await getAllCollectionDocs(userFirestore, commonTerms.collections.ceremonies.name)
            expect(collection.length).to.be.gt(0)
        })
        it("should revert when not logged in", async () => {
            await signOut(userAuth)
            assert.isRejected(getAllCollectionDocs(userFirestore, commonTerms.collections.ceremonies.name))
        })
    })

    describe("fromQueryToFirebaseDocumentInfo", () => {
        it("should return data for a valid collection", async () => {
            // sign in as a coordinator
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
            const collection = await getAllCollectionDocs(userFirestore, commonTerms.collections.ceremonies.name)
            expect(collection.length).to.be.gt(0)
            const collectionInfo = fromQueryToFirebaseDocumentInfo(collection)
            expect(collectionInfo).to.not.be.null
        })
        it("should not return any data when given an empty collection", async () => {
            // Sign in as coordinator.
            const collectionInfo = fromQueryToFirebaseDocumentInfo([] as any)
            expect(collectionInfo.length).to.be.eq(0)
        })
    })

    describe("getDocumentById", () => {
        it("should allow an authenticated user to get a document with their own data", async () => {
            await signInWithEmailAndPassword(userAuth, user.data.email, userPwd)
            const userDoc = await getDocumentById(userFirestore, commonTerms.collections.users.name, user.uid)
            expect(userDoc).to.not.be.null
        })
        it("should revert when not logged in", async () => {
            await signOut(userAuth)
            assert.isRejected(getDocumentById(userFirestore, commonTerms.collections.users.name, user.uid))
        })
        it("should an authenticated user to get a ceremonies document", async () => {
            await signInWithEmailAndPassword(userAuth, user.data.email, userPwd)
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
                user.uid
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
            await adminFirestore
                .collection(getCircuitsCollectionPath(fakeCeremoniesData.fakeCeremonyClosedDynamic.uid))
                .doc(fakeCircuitsData.fakeCircuitSmallNoContributors.uid)
                .delete()

            await adminFirestore
                .collection(commonTerms.collections.ceremonies.name)
                .doc(fakeCeremoniesData.fakeCeremonyClosedDynamic.uid)
                .delete()

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
                user.uid
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
        await adminFirestore.collection(commonTerms.collections.users.name).doc(user.uid).delete()
        await adminFirestore.collection(commonTerms.collections.users.name).doc(coordinatorUid).delete()
        // Remove Auth user.
        await adminAuth.deleteUser(user.uid)
        await adminAuth.deleteUser(coordinatorUid)
        // Delete mock ceremony data.
        await cleanUpRecursively(adminFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)

        // Delete admin app.
        await deleteAdminApp()
    })
})
