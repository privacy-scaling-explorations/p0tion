import chai from "chai"
import chaiAsPromised from "chai-as-promised"

// Config chai.
chai.use(chaiAsPromised)

describe("Finalization", () => {
    // // Sample data for running the test.
    // let userId: string

    // // Initialize admin and user services.
    // const { adminFirestore, adminAuth } = initializeAdminServices()
    // const { userApp } = initializeUserServices()
    // const { userEmail, githubClientId } = getAuthenticationConfiguration()

    // beforeAll(async () => {
    //     // Authenticate user.
    //     const userFirebaseCredentials = envType === TestingEnvironment.DEVELOPMENT ? await createNewFirebaseUserWithEmailAndPw(
    //         userApp,
    //         userEmail,
    //         generatePseudoRandomStringOfNumbers(24)
    //     ) : await authenticateUserWithGithub(userApp, githubClientId)
    //     userId = userFirebaseCredentials.user.uid

    //     // Create the fake data on Firestore.
    //     await adminFirestore
    //         .collection(`ceremonies`)
    //         .doc(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
    //         .set({
    //             ...fakeCeremoniesData.fakeCeremonyOpenedFixed.data
    //         })

    //     await adminFirestore
    //         .collection(`ceremonies/${fakeCeremoniesData.fakeCeremonyOpenedFixed.uid}/circuits`)
    //         .doc(fakeCircuitsData.fakeCircuitSmallNoContributors.uid)
    //         .set({
    //             ...fakeCircuitsData.fakeCircuitSmallNoContributors.data
    //         })

    //     // TODO: we need to remove this sleep and add listeners.
    //     // Wait for Cloud Function execution.
    //     await sleep(3000)
    // })

    it("should allow the coordinator to finalize a ceremony", async () => {})
    it("should prevent standard users from finalizing a ceremony", async () => {})
    it("should return all ceremonies that need finalizing", async () => {})
    it("should store the ceremony as finalized once the process is completed", async () => {})

    // afterAll(async () => {
    //     // Clean ceremony and user from DB.
    //     await adminFirestore.collection("users").doc(userId).delete()

    //     // Remove Auth user.
    //     await adminAuth.deleteUser(userId)

    //     await adminFirestore
    //         .collection(`ceremonies/${fakeCeremoniesData.fakeCeremonyOpenedFixed.uid}/circuits`)
    //         .doc(fakeCircuitsData.fakeCircuitSmallNoContributors.uid)
    //         .delete()

    //     await adminFirestore.collection(`ceremonies`).doc(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid).delete()

    //     // Delete admin app.
    //     await deleteAdminApp()
    // })
})
