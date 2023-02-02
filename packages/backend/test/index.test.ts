import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import admin from "firebase-admin"
import firebaseFncTest from "firebase-functions-test"
// Import the exported function definitions from our functions/index.js file
import { registerAuthUser } from "../src/functions/index"

// Config chai.
chai.use(chaiAsPromised)
const { assert } = chai

// Initialize the firebase-functions-test SDK using environment variables.
// These variables are automatically set by firebase emulators:exec
//
// This configuration will be used to initialize the Firebase Admin SDK, so
// when we use the Admin SDK in the tests below we can be confident it will
// communicate with the emulators, not production.

// TODO: make clear is running in production.
const test = firebaseFncTest({
    databaseURL: process.env.FIREBASE_FIRESTORE_DATABASE_URL,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
})

describe("CF Unit Tests", () => {
    // Sample data.
    const userId = "0000000000000000000000000001"

    afterAll(async () => {
        // Remove user record.
        await admin.firestore().collection("users").doc(userId).delete()

        test.cleanup()
    })

    it("should call an authorized CF and interact with Firestore", async () => {
        const wrapped = test.wrap(registerAuthUser)

        // Make a fake user to pass to the function
        const displayName = "UserA"
        const email = `user-${userId}@example.com`
        const photoURL = `https://www...."`

        const user = test.auth.makeUserRecord({
            uid: userId,
            displayName,
            email,
            photoURL
        })

        // Call the function
        await wrapped(user)

        // Check the data was written to the Firestore emulator
        const snap = await admin.firestore().collection("users").doc(userId).get()
        const data = snap.data()

        assert.propertyVal(data, "name", displayName)
        assert.propertyVal(data, "email", email)
        assert.propertyVal(data, "photoURL", photoURL)
    })
})
