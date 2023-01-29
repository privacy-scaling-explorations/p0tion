import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword } from "firebase/auth"
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
import { getDocumentById } from "../../src/helpers/query"

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

        // Retrieve the current auth user in Firebase.
        let currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
        user1.uid = currentAuthenticatedUser.uid

        // create 2nd user
        await createNewFirebaseUserWithEmailAndPw(userApp, user2.data.email, user2Pwd)

        // Retrieve the current auth user in Firebase.
        currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
        user2.uid = currentAuthenticatedUser.uid
        await sleep(5000) // 5s delay.

        // create the coordinator
        await createNewFirebaseUserWithEmailAndPw(userApp, user3.data.email, user3Pwd)
        currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
        user3.uid = currentAuthenticatedUser.uid
        await sleep(5000) // 5s delay.
    })

    it("should work as expected and return the data for the same user", async () => {
        // login as user1
        await signInWithEmailAndPassword(userAuth, user1.data.email, user1Pwd)
        const userDoc = await getDocumentById(userFirestore, "users", user1.uid)
        const data = userDoc.data()
        expect(data).to.not.be.null
    })

    it("should not return another user's document", async () => {
        // login as user2
        await signInWithEmailAndPassword(userAuth, user2.data.email, user2Pwd)
        // below should fail because we are trying to retrieve a document from another user.
        expect(getDocumentById(userFirestore, "users", user1.uid)).to.be.rejectedWith(
            "Missing or insufficient permissions."
        )
    })

    it("should allow the coordinator to read another user's document", async () => {
        // login as user3
        await signInWithEmailAndPassword(userAuth, user3.data.email, user3Pwd)
        // Retrieve the current auth user in Firebase.
        const currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
        // sleep
        await sleep(5000)
        // add coordinator privileges
        await addCoordinatorPrivileges(adminAuth, user3.uid)
        // force refresh
        await currentAuthenticatedUser.getIdTokenResult(true)
        // retrieve the document of another user
        const userDoc = await getDocumentById(userFirestore, "users", user1.uid)
        const data = userDoc.data()
        expect(data).to.not.be.null
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
