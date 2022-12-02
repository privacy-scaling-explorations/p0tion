import { httpsCallable } from "firebase/functions"
import chai, { assert } from "chai"
import chaiAsPromised from "chai-as-promised"
import { FirebaseDocumentInfo } from "types"
import { getOpenedCeremonies } from "../src/index"
import { initializeAdminServices, initializeUserServices, signInAnonymouslyWithUser, deleteAdminApp } from "./utils"
import { fakeUsersData, fakeCeremoniesData, fakeCircuitsData } from "./data/samples"

// Config chai.
chai.use(chaiAsPromised)

describe("Sample e2e", () => {
    // Sample data for running the test.
    let openedCeremonies: Array<FirebaseDocumentInfo> = []
    let selectedCeremony: FirebaseDocumentInfo

    // Initialize admin and user services.
    const { adminFirestore } = initializeAdminServices()
    const { userApp, userFirestore, userFunctions } = initializeUserServices()

    beforeEach(async () => {
        // Sign-in anonymously with the user.
        await signInAnonymouslyWithUser(userApp)

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

    afterEach(async () => {
        // Clean ceremony and user from DB.
        adminFirestore.collection(`users`).doc(fakeUsersData.fakeUser1.uid).delete()
        await adminFirestore
            .collection(`ceremonies/${fakeCeremoniesData.fakeCeremonyOpenedFixed.uid}/circuits`)
            .doc(fakeCircuitsData.fakeCircuitSmallNoContributors.uid)
            .delete()
        await adminFirestore.collection(`ceremonies`).doc(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid).delete()

        // TODO: remove user(s) from authentication.

        // Delete admin app.
        await deleteAdminApp()
    })
})
