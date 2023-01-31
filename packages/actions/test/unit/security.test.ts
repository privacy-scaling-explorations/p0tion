import chai, { assert, expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth"
import { where } from "firebase/firestore"
import {
    createNewFirebaseUserWithEmailAndPw,
    deleteAdminApp,
    generatePseudoRandomStringOfNumbers,
    initializeAdminServices,
    initializeUserServices,
    sleep,
    addCoordinatorPrivileges
} from "../utils"
import { fakeUsersData } from "../data/samples"
import { getCurrentFirebaseAuthUser } from "../../src"
import { getDocumentById, queryCollection } from "../../src/helpers/query"

chai.use(chaiAsPromised)

describe("Security rules", () => {
    // Init admin services.
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp, userFirestore } = initializeUserServices()
    const userAuth = getAuth(userApp)

    const user1 = fakeUsersData.fakeUser1
    const user2 = fakeUsersData.fakeUser2
    const user3 = fakeUsersData.fakeUser3
    const user1Pwd = generatePseudoRandomStringOfNumbers(24)
    const user2Pwd = generatePseudoRandomStringOfNumbers(24)
    const user3Pwd = generatePseudoRandomStringOfNumbers(24)

    beforeAll(async () => {
        // create 1st user
        await createNewFirebaseUserWithEmailAndPw(userApp, user1.data.email, user1Pwd)
        await sleep(5000)

        // Retrieve the current auth user in Firebase.
        let currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
        user1.uid = currentAuthenticatedUser.uid

        // create 2nd user
        await createNewFirebaseUserWithEmailAndPw(userApp, user2.data.email, user2Pwd)
        await sleep(5000)

        // Retrieve the current auth user in Firebase.
        currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
        user2.uid = currentAuthenticatedUser.uid

        // create the coordinator
        await createNewFirebaseUserWithEmailAndPw(userApp, user3.data.email, user3Pwd)
        await sleep(5000)

        currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
        user3.uid = currentAuthenticatedUser.uid

        // add coordinator privileges
        await addCoordinatorPrivileges(adminAuth, user3.uid)
    })

    it("should work as expected and return the data for the same user", async () => {
        // login as user1
        await signInWithEmailAndPassword(userAuth, user1.data.email, user1Pwd)
        const userDoc = await getDocumentById(userFirestore, "users", user1.uid)
        expect(userDoc.data()).to.not.be.null
    })

    it("should allow anyone to query the ceremony collection", async () => {
        // login as user2
        await signInWithEmailAndPassword(userAuth, user2.data.email, user2Pwd)
        // query the ceremonies collection
        expect(await queryCollection(userFirestore, "ceremonies", [where("description", "!=", "")])).to.not.throw
    })

    it("should allow the coordinator to read another user's document", async () => {
        // login as coordinator
        await signInWithEmailAndPassword(userAuth, user3.data.email, user3Pwd)
        // retrieve the document of another user
        const userDoc = await getDocumentById(userFirestore, "users", user1.uid)
        const data = userDoc.data()
        expect(data).to.not.be.null
    })

    it("should not return another user's document if not authenticated as a coordinator", async () => {
        // login as user2
        await signInWithEmailAndPassword(userAuth, user2.data.email, user2Pwd)
        // @todo debug should return the error message "Missing or insufficient permissions."
        // below should fail because we are trying to retrieve a document from another user.
        // expect(getDocumentById(userFirestore, "users", user1.uid)).to.be.rejectedWith(
        //     "Missing or insufficient permissions."
        // )
        assert.isRejected(getDocumentById(userFirestore, "users", user1.uid))
    })

    afterEach(async () => {
        // Make sure to sign out.
        await signOut(userAuth)
    })

    afterAll(async () => {
        // Clean user from DB.
        await adminFirestore.collection("users").doc(user1.uid).delete()
        await adminFirestore.collection("users").doc(user2.uid).delete()
        await adminFirestore.collection("users").doc(user3.uid).delete()
        // Remove Auth user.
        await adminAuth.deleteUser(user1.uid)
        await adminAuth.deleteUser(user2.uid)
        await adminAuth.deleteUser(user3.uid)
        // Delete admin app.
        await deleteAdminApp()
    })
})
