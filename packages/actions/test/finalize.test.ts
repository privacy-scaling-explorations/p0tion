import chai from "chai"
import chaiAsPromised from "chai-as-promised"
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

describe("Finalize action", () => {
    // Sample data for running the test.
    let userId: string

    // Initialize admin and user services.
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp } = initializeUserServices()

    beforeAll(async () => {
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
    })

    it("should allow the coordinator to finalize a ceremony", async () => {})
    it("should prevent standard users from finalizing a ceremony", async () => {})
    it("should return all ceremonies that need finalizing", async () => {})
    it("should store the ceremony as finalized once the process is completed", async () => {})

    afterAll(async () => {
        // Clean ceremony and user from DB.
        await adminFirestore.collection("users").doc(userId).delete()

        await adminFirestore
            .collection(`ceremonies/${fakeCeremoniesData.fakeCeremonyOpenedFixed.uid}/circuits`)
            .doc(fakeCircuitsData.fakeCircuitSmallNoContributors.uid)
            .delete()

        await adminFirestore.collection(`ceremonies`).doc(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid).delete()

        // Remove Auth user.
        await adminAuth.deleteUser(userId)

        // Delete admin app.
        await deleteAdminApp()
    })
})
