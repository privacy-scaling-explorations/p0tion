import chai from "chai"
import chaiAsPromised from "chai-as-promised"

// Config chai.
chai.use(chaiAsPromised)

describe("Setup action", () => {
    // Sample data for running the test.
    // let userId: string

    // // Initialize user and admin services.
    // const { userApp } = initializeUserServices()
    // const { adminFirestore, adminAuth } = initializeAdminServices()
    // const { userEmail, githubClientId } = getAuthenticationConfiguration()

    // beforeAll(async () => {
    //     // Authenticate user.
    //     const userFirebaseCredentials = envType === TestingEnvironment.DEVELOPMENT ? await createNewFirebaseUserWithEmailAndPw(
    //         userApp,
    //         userEmail,
    //         generatePseudoRandomStringOfNumbers(24)
    //     ) : await authenticateUserWithGithub(userApp, githubClientId)
    //     userId = userFirebaseCredentials.user.uid
    // })

    it("should delete all files related to a contribution", () => {})
    it("there should be some files in the output path for a ceremony", () => {})
    it("should not delete anything should there not be files in the specific director", () => {})

    // afterAll(async () => {
    //     // Clean ceremony and user from DB.
    //     await adminFirestore.collection("users").doc(userId).delete()

    //     // Remove Auth user.
    //     await adminAuth.deleteUser(userId)

    //     // Delete admin app.
    //     await deleteAdminApp()
    // })
})
