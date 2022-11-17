import admin from "firebase-admin"
import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getFunctions, httpsCallable } from "firebase/functions"
import { getAuth, signInAnonymously } from "firebase/auth"
import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { getCurrentFirebaseAuthUser, getCeremonyCircuits, getOpenedCeremonies } from "../src/index.js"
import { FirebaseDocumentInfo } from "../types/index.js"

// Config chai.
chai.use(chaiAsPromised)

describe("e2e Test Sample", () => {
  // Sample data for running the test.
  let openedCeremonies: Array<FirebaseDocumentInfo> = []
  let selectedCeremonyCircuits: Array<FirebaseDocumentInfo> = []
  let selectedCeremony: FirebaseDocumentInfo

  // Sample user.
  const sampleUser = {
    uid: "", // Defined after the anonymous sign in.
    creationTime: Date.now(),
    email: "alice@example.com",
    emailVerified: false,
    lastSignInTime: Date.now() + 1,
    lastUpdated: Date.now() + 1,
    name: "Alice",
    photoURL: ""
  }

  // Sample ceremony.
  const sampleCeremony = {
    uid: "rcWHse2WuwrmGYEtCDhS",
    coordinatorId: "0cqqE9RamNOvOZbHYhftzeno0955", // different from sample user.
    description: "Dummy ceremony",
    endDate: 1671290221000,
    startDate: 1667315821000,
    lastUpdated: Date.now() + 1,
    penalty: 720,
    prefix: "dummy-ceremony",
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

  // Step 0. Initialization of Firebase Admin SDK and sample user.
  admin.initializeApp({})
  const sampleUserApp = initializeApp({})

  // Get Firebase services for admin.
  const adminFirestore = admin.firestore()

  // Sample user.
  const sampleUserFirestore = getFirestore(sampleUserApp)
  const sampleUserFunctions = getFunctions(sampleUserApp)

  beforeEach(async () => {
    // Sign in anonymously.
    const auth = getAuth(sampleUserApp)
    const aliceCredentials = await signInAnonymously(auth)

    // Set uid.
    sampleUser.uid = aliceCredentials.user.uid

    // Step 2.A Create a one dummy ceremony.
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

    // Step 2.A Get opened ceremonies (I need to create a one dummy ceremony with at least one circuit) using the query (action helper).
    openedCeremonies = await getOpenedCeremonies(sampleUserFirestore)

    // Select the first ceremony.
    selectedCeremony = openedCeremonies.at(0)!

    // Step 2.B Get ceremony circuits using the query (action helper).
    selectedCeremonyCircuits = await getCeremonyCircuits(sampleUserFirestore, selectedCeremony.id)
  })

  it(`shouldn't be possible for a non authenticated user to call checkParticipantForCeremony() CF to check for eligibility`, async () => {
    // should fetch custom claims now.
    const user = getCurrentFirebaseAuthUser(sampleUserApp)
    console.log(user)

    // Step 2.C Call checkParticipantForCeremony Cloud Function and get the result (should return `true`).
    const checkParticipantForCeremony = httpsCallable(sampleUserFunctions, "checkParticipantForCeremony")

    const data = await checkParticipantForCeremony({ ceremonyId: selectedCeremony.id })

    console.log(data)
    console.log(selectedCeremonyCircuits)
  })

  afterAll(() => {
    // Step 3. Clean ceremony and user from DB.
    // adminFirestore.collection(`users`).doc(alice.uid).delete()
    adminFirestore.collection(`ceremonies`).doc(sampleCeremony.uid).delete()
    adminFirestore.collection(`ceremonies/${sampleCeremony.uid}/circuits`).doc(sampleCircuit.uid).delete()
  })
})
