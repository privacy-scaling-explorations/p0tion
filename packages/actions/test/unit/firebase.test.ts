import { expect } from "chai"
import { FirebaseApp, initializeApp } from "firebase/app"
import { fakeUsersData } from "../data/samples"
import { getCurrentFirebaseAuthUser } from "../../src"
import {
    authenticateUserWithGithub,
    createNewFirebaseUserWithEmailAndPw,
    deleteAdminApp,
    envType,
    generatePseudoRandomStringOfNumbers,
    getAuthenticationConfiguration,
    initializeAdminServices,
    initializeUserServices
} from "../utils"
import { TestingEnvironment } from "../../types"

/**
 * Unit test for Firebase helpers.
 * @notice some of these methods are used as a core component for authentication.
 */
describe("Firebase", () => {
    // Init admin services.
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { githubClientId } = getAuthenticationConfiguration()

    /** Authentication Core */
    describe("getCurrentFirebaseAuthUser()", () => {
        // Prepare all necessary data to execute the unit tests for the method.
        let firebaseUserApp: FirebaseApp
        let userId: string
        const fakeUser = fakeUsersData.fakeUser1

        beforeAll(async () => {
            // Get and assign configs.
            const { userApp } = initializeUserServices()
            firebaseUserApp = userApp
        })

        it("should revert when there is no authenticated user", async () => {
            expect(() => getCurrentFirebaseAuthUser(firebaseUserApp)).to.throw(
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
            const userFirebaseCredentials =
                envType === TestingEnvironment.DEVELOPMENT
                    ? await createNewFirebaseUserWithEmailAndPw(
                          firebaseUserApp,
                          fakeUser.data.email,
                          generatePseudoRandomStringOfNumbers(24)
                      )
                    : await authenticateUserWithGithub(firebaseUserApp, githubClientId)
            const userFromCredential = userFirebaseCredentials.user
            userId = userFromCredential.uid

            // When.
            const currentAuthenticatedUser = getCurrentFirebaseAuthUser(firebaseUserApp)

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
            await adminFirestore.collection("users").doc(userId).delete()
            await adminAuth.deleteUser(userId)
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
