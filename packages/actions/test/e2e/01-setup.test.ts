import chai from "chai"
import chaiAsPromised from "chai-as-promised"

// Config chai.
chai.use(chaiAsPromised)

describe("Setup", () => {
    // // Sample data for running the test.
    // let userId: string

    // // Initialize user and admin services.
    // const { userApp, userFunctions } = initializeUserServices()
    // const { adminFirestore, adminAuth } = initializeAdminServices()

    // // Get configs for storage.
    // const { ceremonyBucketPostfix } = getStorageConfiguration()
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

    // it("should fail to create a sample ceremony without being a coordinator", async () => {
    //     const ceremonyData = fakeCeremoniesData.fakeCeremonyOpenedDynamic

    //     // Should return the bucket name.
    //     const bucket = getBucketName(ceremonyBucketPostfix, ceremonyData.data.prefix)

    //     assert.isRejected(createS3Bucket(userFunctions, bucket))
    // })

    it("should create a new ceremony", async () => {})
    it("should revert when given a malformed r1cs file", async () => {})
    it("should upload a file to s3", async () => {})
    it("should fail to upload to a non existent bucket", async () => {})
    it("should close a multi part upload", async () => {})
    it("should do a full multi part upload", async () => {})
    it("should return true for an existing object inside a bucket", async () => {})
    it("should return false for an non existing object inside a bucket", async () => {})
    it("should correctly estimate PoT given the number of constraints", async () => {})

    // afterAll(async () => {
    //     // Clean ceremony and user from DB.
    //     await adminFirestore.collection("users").doc(userId).delete()

    //     // Remove Auth user.
    //     await adminAuth.deleteUser(userId)

    //     // Delete admin app.
    //     await deleteAdminApp()
    // })
})
