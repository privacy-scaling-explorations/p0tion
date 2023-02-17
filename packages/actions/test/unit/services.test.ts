import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { initializeApp } from "firebase/app"
import dotenv from "dotenv"
import { deleteAdminApp, envType } from "../utils"
import { initializeFirebaseCoreServices } from "../../src"
import { getFirebaseFunctions, getFirestoreDatabase, initializeFirebaseApp } from "../../src/helpers/services"
import { TestingEnvironment } from "../../src/types/enums"

chai.use(chaiAsPromised)
dotenv.config()

/**
 * Unit test for Services helpers.
 * @notice some of these methods are used as a core component for authentication.
 */
describe("Services", () => {
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
                expect(firebaseApp.options.apiKey).to.be.eq(process.env.FIREBASE_API_KEY!)
            })
        })
    }

    /** Helpers */
    describe("initializeFirebaseApp()", () => {
        if (envType === TestingEnvironment.DEVELOPMENT) {
            it("should create the default app when not configured correctly", async () => {
                // make sure the default app does not exist.
                await deleteAdminApp()
                const firebaseApp = initializeFirebaseApp({
                    apiKey: "wrong",
                    authDomain: "wrong",
                    projectId: "wrong",
                    messagingSenderId: "wrong",
                    appId: "wrong"
                })
                expect(firebaseApp.name).to.equal("[DEFAULT]")
                expect(firebaseApp.options.apiKey).to.eq("wrong")
            })
        } else {
            it("should revert when provided wrong arguments and the default app exists already", async () => {
                expect(() =>
                    initializeFirebaseApp({
                        apiKey: "wrong",
                        authDomain: "wrong",
                        projectId: "wrong",
                        messagingSenderId: "wrong",
                        appId: "wrong"
                    })
                ).to.throw(
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
        }
    })

    describe("getFirestoreDatabase()", () => {
        it("should revert when the application is not configured correctly", async () => {
            expect(() => getFirestoreDatabase(initializeApp())).to.throw(
                "Firebase: Need to provide options, when not being deployed to hosting via source. (app/no-options)."
            )
        })
        if (envType === TestingEnvironment.PRODUCTION) {
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
        }
    })
    describe("getFirebaseFunctions()", () => {
        it("should revert when the application is not configured correctly", async () => {
            expect(() => getFirebaseFunctions(initializeApp())).to.throw(
                "Firebase: Need to provide options, when not being deployed to hosting via source. (app/no-options)."
            )
        })
        if (envType === TestingEnvironment.PRODUCTION) {
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
        }
    })

    afterAll(async () => {
        // Delete admin app.
        await deleteAdminApp()
    })
})
