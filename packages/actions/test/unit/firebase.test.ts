import { expect } from "chai"
import { OAuthCredential } from "firebase/auth"
import { initializeApp } from "firebase/app"
import { fakeUsersData } from "../data/samples"
import {
    getCurrentFirebaseAuthUser,
    getFirebaseFunctions,
    getFirestoreDatabase,
    initializeFirebaseApp,
    initializeFirebaseCoreServices,
    signInToFirebaseWithCredentials
} from "../../src"
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

    // check config
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

    describe("signInToFirebaseWithCredentials()", () => {
        const { userApp } = initializeUserServices()
        it("should revert when provided the wrong credentials", async () => {
            try {
                await signInToFirebaseWithCredentials(userApp, new OAuthCredential())
            } catch (error: any) {
                expect(error.toString()).to.be.eq(
                    "FirebaseError: Firebase: Invalid IdP response/credential: http://localhost?&providerId=undefined (auth/invalid-credential-or-provider-id)."
                )
            }
        })
        it("should revert when the application is not configured correctly", async () => {
            expect(() => signInToFirebaseWithCredentials(initializeApp(), new OAuthCredential())).to.throw(
                Error,
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
    describe("initializeFirebaseCoreServices()", () => {
        it("should successfully initialize Firebase services with correct credentials", async () => {
            const { firebaseApp, firestoreDatabase, firebaseFunctions } = await initializeFirebaseCoreServices(
                process.env.FIREBASE_API_KEY!,
                process.env.FIREBASE_AUTH_DOMAIN!,
                process.env.FIREBASE_PROJECT_ID!,
                process.env.FIREBASE_MESSAGING_SENDER_ID!,
                process.env.FIREBASE_APP_ID!
            )

            expect(firebaseApp).to.not.be.null
            expect(firestoreDatabase).to.not.be.null
            expect(firebaseFunctions).to.not.be.null
        })
    })

    /** Helpers */
    describe("initializeFirebaseApp()", () => {
        it("should revert when the application is not configured correctly", async () => {
            expect(() =>
                initializeFirebaseApp({
                    apiKey: "wrong",
                    authDomain: "wrong",
                    projectId: "wrong",
                    messagingSenderId: "wrong",
                    appId: "wrong"
                })
            ).to.throw(
                Error,
                "Firebase: Firebase App named '[DEFAULT]' already exists with different options or config (app/duplicate-app)."
            )
        })
        it("should initialize a Firebase application", async () => {
            const firebaseApp = initializeFirebaseApp({
                apiKey: process.env.FIREBASE_API_KEY!,
                authDomain: process.env.FIREBASE_AUTH_DOMAIN!,
                projectId: process.env.FIREBASE_PROJECT_ID!,
                messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID!,
                appId: process.env.FIREBASE_APP_ID!
            })
            expect(firebaseApp).to.not.be.null
        })
    })
    describe("getFirestoreDatabase()", () => {
        it("should revert when the application is not configured correctly", async () => {
            expect(() => getFirestoreDatabase(initializeApp())).to.throw(
                Error,
                "Firebase: Need to provide options, when not being deployed to hosting via source. (app/no-options)."
            )
        })
        it("should return the Firestore database for a given application", async () => {
            const firestoreDatabase = getFirestoreDatabase(
                initializeFirebaseApp({
                    apiKey: process.env.FIREBASE_API_KEY!,
                    authDomain: process.env.FIREBASE_AUTH_DOMAIN!,
                    projectId: process.env.FIREBASE_PROJECT_ID!,
                    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID!,
                    appId: process.env.FIREBASE_APP_ID!
                })
            )
            expect(firestoreDatabase).to.not.be.null
        })
    })
    describe("getFirebaseFunctions()", () => {
        it("should revert when the application is not configured correctly", async () => {
            expect(() => getFirebaseFunctions(initializeApp())).to.throw(
                Error,
                "Firebase: Need to provide options, when not being deployed to hosting via source. (app/no-options)."
            )
        })
        it("should return the Firebase functions for a given application", async () => {
            const firebaseFunctions = getFirebaseFunctions(
                initializeFirebaseApp({
                    apiKey: process.env.FIREBASE_API_KEY!,
                    authDomain: process.env.FIREBASE_AUTH_DOMAIN!,
                    projectId: process.env.FIREBASE_PROJECT_ID!,
                    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID!,
                    appId: process.env.FIREBASE_APP_ID!
                })
            )
            expect(firebaseFunctions).to.not.be.null
        })
    })

    afterAll(async () => {
        // Delete admin app.
        await deleteAdminApp()
    })
})
