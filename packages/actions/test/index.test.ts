import { httpsCallable } from "firebase/functions"
import chai, { assert } from "chai"
import chaiAsPromised from "chai-as-promised"
import { FirebaseDocumentInfo } from "types"
import { getOpenedCeremonies } from "../src/index"
import {
    initializeAdminServices,
    initializeUserServices,
    signInAnonymouslyWithUser,
    deleteAdminApp,
    sleep
} from "./utils"
import { fakeCeremoniesData, fakeCircuitsData } from "./data/samples"

// Config chai.
chai.use(chaiAsPromised)

describe("Sample e2e", () => {
    // Sample data for running the test.
    let userId: string
    let openedCeremonies: Array<FirebaseDocumentInfo> = []
    let selectedCeremony: FirebaseDocumentInfo

    // Initialize admin and user services.
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp, userFirestore, userFunctions } = initializeUserServices()

    beforeEach(async () => {
        // Sign-in anonymously with the user.
        const { newUid } = await signInAnonymouslyWithUser(userApp)
        userId = newUid

        // Create the fake data on Firestore.
        await adminFirestore
            .collection(`ceremonies`)
            .doc(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            .set({
                ...fakeCeremoniesData.fakeCeremonyOpenedFixed.data
            })

        await adminFirestore
            .collection(`ceremonies/${fakeCeremoniesData.fakeCeremonyOpenedFixed.uid}/circuits`)
            .doc(fakeCircuitsData.fakeCircuitSmallNoContributors.uid)
            .set({
                ...fakeCircuitsData.fakeCircuitSmallNoContributors.data
            })

        // TODO: we need to remove this sleep and add listeners.
        // Wait for Cloud Function execution.
        await sleep(3000)

        // Get opened ceremonies.
        openedCeremonies = await getOpenedCeremonies(userFirestore)

        // Select the first ceremony.
        selectedCeremony = openedCeremonies.at(0)!
    })

    it("should reject when user is not authenticated", async () => {
        // Call checkParticipantForCeremony Cloud Function and check the result.
        const checkParticipantForCeremony = httpsCallable(userFunctions, "checkParticipantForCeremony", {})

        assert.isRejected(checkParticipantForCeremony({ ceremonyId: selectedCeremony.id }))
    })

    afterAll(async () => {
        // Clean ceremony and user from DB.
        await adminFirestore.collection("users").doc(userId).delete()

        await adminFirestore
            .collection(`ceremonies/${fakeCeremoniesData.fakeCeremonyOpenedFixed.uid}/circuits`)
            .doc(fakeCircuitsData.fakeCircuitSmallNoContributors.uid)
            .delete()

        // TODO: use a listener.
        // nb. workaround (wait until circuit has been deleted, then delete the ceremony).
        await sleep(1000)

        await adminFirestore.collection(`ceremonies`).doc(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid).delete()

        // Remove Auth user.
        await adminAuth.deleteUser(userId)

        // Delete admin app.
        await deleteAdminApp()
    })
})
