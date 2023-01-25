import { expect } from "chai"
import { initializeApp } from "firebase/app"
import { fakeUsersData } from "../data/samples"
import { getCurrentFirebaseAuthUser } from "../../src"
import {
    createNewFirebaseUserWithEmailAndPw,
    deleteAdminApp,
    generatePseudoRandomStringOfNumbers,
    initializeAdminServices,
    initializeUserServices
} from "../utils"

/**
 * Unit test for Firebase helpers.
 * @notice some of these methods are used as a core component for authentication.
 */
describe("Firebase", () => {
    // Init admin services.
    const { adminFirestore, adminAuth } = initializeAdminServices()

    /** Authentication Core */
    describe("getCurrentFirebaseAuthUser()", () => {
        // Prepare all necessary data to execute the unit tests for the method.
        const user = fakeUsersData.fakeUser1

        const { userApp } = initializeUserServices()

        it("should revert when there is no authenticated user", async () => {
            expect(() => getCurrentFirebaseAuthUser(userApp)).to.throw(
                Error,
                `Unable to find the user currently authenticated with Firebase. Verify that the Firebase application is properly configured and repeat user authentication before trying again.`
            )
        })

        it("should revert when the application is not configured correctly", async () => {
            expect(() => getCurrentFirebaseAuthUser(initializeApp())).to.throw(
                Error,
                "Firebase: Need to provide options, when not being deployed to hosting via source. (app/no-options)."
            )
        })

        it("should return the current Firebase user authenticated for a given application", async () => {
            // Given.
            const userFirebaseCredentials = await createNewFirebaseUserWithEmailAndPw(
                userApp,
                user.data.email,
                generatePseudoRandomStringOfNumbers(24)
            )
            const userFromCredential = userFirebaseCredentials.user
            user.uid = userFromCredential.uid

            // When.
            const currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)

            // Then.
            expect(currentAuthenticatedUser.email).to.be.equal(userFromCredential.email)
            expect(currentAuthenticatedUser.emailVerified).to.be.equal(userFromCredential.emailVerified)
            expect(currentAuthenticatedUser.displayName).to.be.equal(userFromCredential.displayName)
            expect(currentAuthenticatedUser.photoURL).to.be.equal(userFromCredential.photoURL)
            expect(new Date(String(currentAuthenticatedUser.metadata.creationTime)).valueOf()).to.be.equal(
                new Date(String(userFromCredential.metadata.creationTime)).valueOf()
            )
            expect(new Date(String(currentAuthenticatedUser.metadata.lastSignInTime)).valueOf()).to.be.equal(
                new Date(String(userFromCredential.metadata.lastSignInTime)).valueOf()
            )
        })

        afterAll(async () => {
            // Finally.
            await adminFirestore.collection("users").doc(user.uid).delete()
            await adminAuth.deleteUser(user.uid)
        })
    })

    describe("signInToFirebaseWithCredentials()", () => {})
    describe("initializeFirebaseCoreServices()", () => {})

    /** Helpers */
    describe("initializeFirebaseApp()", () => {})
    describe("getFirestoreDatabase()", () => {})
    describe("getFirebaseFunctions()", () => {})

    afterAll(async () => {
        // Delete admin app.
        await deleteAdminApp()
    })
})
