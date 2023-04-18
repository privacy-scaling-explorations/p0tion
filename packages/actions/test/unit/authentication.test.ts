import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { User, OAuthCredential, getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth"
import { initializeApp } from "firebase/app"
import {
    createNewFirebaseUserWithEmailAndPw,
    deleteAdminApp,
    envType,
    generatePseudoRandomStringOfNumbers,
    initializeAdminServices,
    initializeUserServices,
    setCustomClaims,
    sleep
} from "../utils"
import { fakeUsersData } from "../data/samples"
import { commonTerms, getCurrentFirebaseAuthUser, isCoordinator, signInToFirebaseWithCredentials } from "../../src"
import { TestingEnvironment } from "../../src/types/enums"

chai.use(chaiAsPromised)

/**
 * Unit test for Authentication helpers.
 * @notice some of these methods are used as a core component for authentication.
 */
describe("Authentication", () => {
    // check config if we are running tests on production.
    if (envType === TestingEnvironment.PRODUCTION) {
        beforeAll(() => {
            if (
                !process.env.FIREBASE_API_KEY ||
                !process.env.FIREBASE_AUTH_DOMAIN ||
                !process.env.FIREBASE_PROJECT_ID ||
                !process.env.FIREBASE_MESSAGING_SENDER_ID ||
                !process.env.FIREBASE_APP_ID
            )
                throw new Error("Missing environment variables for Firebase tests.")
        })
    }

    // Init admin services.
    const { adminFirestore, adminAuth } = initializeAdminServices()

    /** Authentication Core */
    describe("getCurrentFirebaseAuthUser()", () => {
        // Prepare all necessary data to execute the unit tests for the method.
        const user = fakeUsersData.fakeUser1
        const userPassword = generatePseudoRandomStringOfNumbers(24)
        const { userApp } = initializeUserServices()
        const userAuth = getAuth(userApp)

        let userUID: string
        let userFromCredential: User

        beforeAll(async () => {
            const userFirebaseCredentials = await createNewFirebaseUserWithEmailAndPw(
                userApp,
                user.data.email,
                userPassword
            )

            await sleep(500)
            userFromCredential = userFirebaseCredentials.user

            const authUser = getCurrentFirebaseAuthUser(userApp)
            userUID = authUser.uid
        })

        it("should return the current Firebase user authenticated for a given application", async () => {
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

        it("should revert when there is no authenticated user", async () => {
            // Delete user to test this and following scenario
            signOut(userAuth)
            await adminFirestore.collection(commonTerms.collections.users.name).doc(userUID).delete()

            expect(() => getCurrentFirebaseAuthUser(userApp)).to.throw(
                `Unable to find the user currently authenticated with Firebase. Verify that the Firebase application is properly configured and repeat user authentication before trying again.`
            )
        })

        it("should revert when the application is not configured correctly", async () => {
            expect(() => getCurrentFirebaseAuthUser(initializeApp())).to.throw(
                "Firebase: Need to provide options, when not being deployed to hosting via source. (app/no-options)."
            )
        })

        afterAll(async () => {
            // Finally.
            await adminFirestore.collection(commonTerms.collections.users.name).doc(userUID).delete()
            await adminAuth.deleteUser(userUID)
        })
    })

    describe("block user by coordinator", () => {
        const userEmail = "user@user.com"
        const userPassword = generatePseudoRandomStringOfNumbers(20)
        let userUID: string
        const { userApp } = initializeUserServices()
        const userAuth = getAuth(userApp)

        beforeAll(async () => {
            const userFirebaseCredentials = await createNewFirebaseUserWithEmailAndPw(userApp, userEmail, userPassword)

            userUID = userFirebaseCredentials.user.uid
            await setCustomClaims(adminAuth, userUID, { participant: true })
        })

        it("should not be possible to authenticate if the user has been disabled from the Authentication service by coordinator", async () => {
            // Disable user.
            const disabledRecord = await adminAuth.updateUser(userUID, { disabled: true })
            expect(disabledRecord.disabled).to.be.true

            // Try to authenticate with the disabled user.
            await expect(signInWithEmailAndPassword(userAuth, userEmail, userPassword)).to.be.rejectedWith(
                "Firebase: Error (auth/user-disabled)."
            )

            // re enable the user
            const recordReset = await adminAuth.updateUser(userUID, {
                disabled: false
            })
            expect(recordReset.disabled).to.be.false
        })

        afterAll(async () => {
            await adminFirestore.collection(commonTerms.collections.users.name).doc(userUID).delete()
            await adminAuth.deleteUser(userUID)
        })
    })

    // run these only in prod mode
    if (envType === TestingEnvironment.PRODUCTION) {
        describe("signInToFirebaseWithCredentials()", () => {
            const { userApp } = initializeUserServices()
            it("should revert when provided the wrong credentials", async () => {
                await expect(signInToFirebaseWithCredentials(userApp, new OAuthCredential())).to.be.rejectedWith(
                    "Firebase: Invalid IdP response/credential: http://localhost?&providerId=undefined (auth/invalid-credential-or-provider-id)."
                )
            })
            it("should revert when the application is not configured correctly", async () => {
                expect(() => signInToFirebaseWithCredentials(initializeApp(), new OAuthCredential())).to.throw(
                    "Firebase: Need to provide options, when not being deployed to hosting via source. (app/no-options)."
                )
            })
            it("should sign in to Firebase with the provided credentials", async () => {
                // nb. this test requires a working OAuth2 automated flow.
            })
            it("should sign in to Firebase with the provided credentials and return the user", async () => {
                // nb. this test requires a working OAuth2 automated flow.
            })
        })
    }

    describe("isCoordinator", () => {
        const userEmail = "user@user.com"
        const coordinatorEmail = "coordinator@coordinator.com"
        const userPassword = generatePseudoRandomStringOfNumbers(20)
        const coordinatorPassword = generatePseudoRandomStringOfNumbers(20)
        let userUID: string
        let coordinatorUID: string
        const { userApp } = initializeUserServices()
        const userAuth = getAuth(userApp)

        beforeAll(async () => {
            const userFirebaseCredentials = await createNewFirebaseUserWithEmailAndPw(userApp, userEmail, userPassword)
            userUID = userFirebaseCredentials.user.uid
            await setCustomClaims(adminAuth, userUID, { participant: true })

            const coordinatorFirebaseCredentials = await createNewFirebaseUserWithEmailAndPw(
                userApp,
                coordinatorEmail,
                coordinatorPassword
            )
            coordinatorUID = coordinatorFirebaseCredentials.user.uid
            await sleep(1000)
            await setCustomClaims(adminAuth, coordinatorUID, { coordinator: true })
        })

        afterEach(async () => signOut(userAuth))

        it("should return true if the user is a coordinator", async () => {
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPassword)
            const user = getCurrentFirebaseAuthUser(userApp)
            expect(await isCoordinator(user)).to.be.true
        })

        it("should return false if the user is not a coordinator", async () => {
            await signInWithEmailAndPassword(userAuth, userEmail, userPassword)
            const user = getCurrentFirebaseAuthUser(userApp)
            expect(await isCoordinator(user)).to.be.false
        })

        it("should throw when given the wrong argument (empty object)", async () => {
            await signOut(userAuth)
            await expect(isCoordinator({} as any)).to.be.rejectedWith("user.getIdTokenResult is not a function")
        })

        afterAll(async () => {
            // Clean ceremony and user from DB.
            await adminFirestore.collection("users").doc(userUID).delete()
            await adminFirestore.collection("users").doc(coordinatorUID).delete()
            // Remove Auth user.
            await adminAuth.deleteUser(userUID)
            await adminAuth.deleteUser(coordinatorUID)
            // Delete admin app.
            await deleteAdminApp()
        })
    })

    afterAll(async () => {
        // Delete admin app.
        await deleteAdminApp()
    })
})
