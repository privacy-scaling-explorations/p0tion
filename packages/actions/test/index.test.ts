import admin from "firebase-admin"
import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getFunctions, httpsCallable } from "firebase/functions"
import { getAuth, signInAnonymously } from "firebase/auth"
import chai, { assert } from "chai"
import chaiAsPromised from "chai-as-promised"
import { FirebaseDocumentInfo } from "types"
import dotenv from "dotenv"
import { getOpenedCeremonies } from "../src/index"

dotenv.config({ path: `${__dirname}/../.env.test` })

// Config chai.
chai.use(chaiAsPromised)

describe("Sample e2e", () => {
    // Sample data for running the test.
    let openedCeremonies: Array<FirebaseDocumentInfo> = []
    let selectedCeremony: FirebaseDocumentInfo

    // Sample user.
    const sampleUser = {
        uid: "", // Defined after the anonymous sign in.
        creationTime: Date.now(),
        email: "sampleuser@example.com",
        emailVerified: false,
        lastSignInTime: Date.now() + 1,
        lastUpdated: Date.now() + 1,
        name: "Sample",
        photoURL: ""
    }

    // Sample ceremony.
    const sampleCeremony = {
        uid: "rcWHse2WuwrmGYEtCDhS",
        coordinatorId: "0cqqE9RamNOvOZbHYhftzeno0955", // different from sample user.
        description: "Sample ceremony",
        startDate: Date.now() + 86400000,
        endDate: Date.now() + 86400000 * 2,
        lastUpdated: Date.now(),
        penalty: 720,
        prefix: "sample-ceremony",
        state: 2, // Opened.
        timeoutType: 2,
        type: 2
    }

    // Sample circuit.
    const sampleCircuit = {
        uid: "KInbENc5N6WzuwG89Vil",
        avgTimings: {
            contributionComputation: 0,
            fullContribution: 0,
            verifyCloudFunction: 0
        },
        description: "sample circuit",
        files: {
            initialZkeyBlake2bHash: "",
            initialZkeyFilename: "",
            initialZkeyStoragePath: "",
            potBlake2bHash: "",
            potFilename: "",
            potStoragePath: "",
            r1csBlake2bHash: "",
            r1csFilename: "",
            r1csStoragePath: ""
        },
        lastUpdated: Date.now() + 1,
        metadata: {
            constraints: 3,
            curve: "bn-128",
            labels: 8,
            outputs: 3,
            pot: 3,
            privateInputs: 4,
            publicOutputs: 0,
            wires: 8
        },
        name: "sample circuit",
        prefix: "sample_circuit",
        sequencePosition: 1,
        timeoutMaxContributionWaitingTime: 10,
        waitingQueue: {
            completedContributions: 0,
            contributors: [],
            currentContributor: "",
            failedContributions: 0
        },
        zKeySizeInBytes: 4380
    }

    // Init Firebase App for Admin and Sample user.
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID })
    const adminFirestore = admin.firestore()

    const sampleUserApp = initializeApp({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
    })

    const sampleUserFirestore = getFirestore(sampleUserApp)
    const sampleUserFunctions = getFunctions(sampleUserApp)

    beforeEach(async () => {
        // Sign in anonymously.
        const auth = getAuth(sampleUserApp)
        const sampleUserCredentials = await signInAnonymously(auth)

        // Set uid.
        sampleUser.uid = sampleUserCredentials.user.uid

        // Create the sample ceremony.
        await adminFirestore
            .collection(`ceremonies`)
            .doc(sampleCeremony.uid)
            .set({
                ...sampleCeremony
            })
        await adminFirestore
            .collection(`ceremonies/${sampleCeremony.uid}/circuits`)
            .doc(sampleCircuit.uid)
            .set({
                ...sampleCircuit
            })

        // Get opened ceremonies.
        openedCeremonies = await getOpenedCeremonies(sampleUserFirestore)

        // Select the first ceremony.
        selectedCeremony = openedCeremonies.at(0)!
    })

    it("should reject when user is not authenticated", async () => {
        // Call checkParticipantForCeremony Cloud Function and check the result.
        const checkParticipantForCeremony = httpsCallable(sampleUserFunctions, "checkParticipantForCeremony", {})

        assert.isRejected(checkParticipantForCeremony({ ceremonyId: selectedCeremony.id }))
    })

    afterAll(async () => {
        // Clean ceremony and user from DB.
        adminFirestore.collection(`users`).doc(sampleUser.uid).delete()
        await adminFirestore.collection(`ceremonies`).doc(sampleCeremony.uid).delete()
        await adminFirestore.collection(`ceremonies/${sampleCeremony.uid}/circuits`).doc(sampleCircuit.uid).delete()

        // Delete admin app.
        await Promise.all(admin.apps.map((app) => app?.delete()))
    })
})
