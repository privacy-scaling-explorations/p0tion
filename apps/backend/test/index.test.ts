import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import admin from "firebase-admin"
import firebaseFncTest from "firebase-functions-test"
// Import the exported function definitions from our functions/index.js file
import { registerAuthUser } from "../src/functions/index.js"

// Config chai.
chai.use(chaiAsPromised)
const { expect } = chai

// Initialize the firebase-functions-test SDK using environment variables.
// These variables are automatically set by firebase emulators:exec
//
// This configuration will be used to initialize the Firebase Admin SDK, so
// when we use the Admin SDK in the tests below we can be confident it will
// communicate with the emulators, not production.
const test = firebaseFncTest({
  databaseURL: process.env.FIREBASE_FIRESTORE_DATABASE_URL,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
})

describe("Unit tests", () => {
  afterAll(() => {
    test.cleanup()
  })

  it("tests an Auth function that interacts with Firestore", async () => {
    const wrapped = test.wrap(registerAuthUser)

    // Make a fake user to pass to the function
    const uid = `${new Date().getTime()}`
    const displayName = "UserA"
    const email = `user-${uid}@example.com`
    const photoURL = `https://www...."`

    const user = test.auth.makeUserRecord({
      uid,
      displayName,
      email,
      photoURL
    })

    // Call the function
    await wrapped(user)

    // Check the data was written to the Firestore emulator
    const snap = await admin.firestore().collection("users").doc(uid).get()
    const data = snap.data()

    expect(data?.name).to.eql(displayName)
    expect(data?.email).to.eql(email)
    expect(data?.photoURL).to.eql(photoURL)
  })

  it("should reject an Auth function when called without an authenticated user", async () => {
    const wrapped = test.wrap(registerAuthUser)

    // Call the function
    await expect(wrapped).to.be.rejectedWith(Error)
  })
})
