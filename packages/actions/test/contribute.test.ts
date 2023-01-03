import chai, { assert } from "chai"
import chaiAsPromised from "chai-as-promised"
import { FirebaseDocumentInfo } from "types"
import { checkParticipantForCeremony, getCeremonyCircuits, getOpenedCeremonies } from "../src/index"
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

describe("Contribute action", () => {
    // Sample data for running the test.
    let userId: string
    let openedCeremonies: Array<FirebaseDocumentInfo> = []
    let selectedCeremony: FirebaseDocumentInfo

    // Initialize admin and user services.
    const { adminFirestore, adminAuth, adminApp } = initializeAdminServices()
    const { userApp, userFirestore, userFunctions } = initializeUserServices()

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

        // Get opened ceremonies.
        openedCeremonies = await getOpenedCeremonies(userFirestore)

        // Select the first ceremony.
        selectedCeremony = openedCeremonies.at(0)!
    })

    it('should allow an user to contribute', async () => {})
    it('should block a contributor after timeout', async () => {})
    it('should return all open ceremonies', async () => {
        const openedCeremonies = await getOpenedCeremonies(userFirestore)
        expect(openedCeremonies.length).toBeGreaterThan(0)
    })
    it('should return all circuits for a particular ceremony', async () => {
        const openedCeremonies = await getOpenedCeremonies(userFirestore)
        const circuits = await getCeremonyCircuits(userFirestore, openedCeremonies.at(0)?.id!)
        expect(circuits.length).toBeGreaterThan(0)
    })
    it('should return an empty array when fetching circuits for non existent ceremony', async () => {
        expect((await getCeremonyCircuits(userFirestore, '88')).length).toBe(0)
    })
    it('should get the next circuit ready for contribution', async () => {})
    it('should resume a contribution after a timeout', async () => {})
    it('should fail to resume a contribution on a ceremony where the user is not timed out', async () => {})
    it('should get the contributor\'s attestation', async () => {})
    it('should continue to contribute to the next ceremony with makeProgressToNextContribution cloud function', async () => {})
    it('should revert when querying for participant of a non existent ceremony', async () => {})

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