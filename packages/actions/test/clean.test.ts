import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { initializeAdminServices, initializeUserServices, signInAnonymouslyWithUser, deleteAdminApp } from "./utils"

// Config chai.
chai.use(chaiAsPromised)

describe("Setup action", () => {
    // Sample data for running the test.
    let userId: string

    // Initialize admin and user services.
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp } = initializeUserServices()

    beforeEach(async () => {
        // Sign-in anonymously with the user.
        const { newUid } = await signInAnonymouslyWithUser(userApp)
        userId = newUid
    })

    it("should delete all files related to a contribution", () => {})
    it("there should be some files in the output path for a ceremony", () => {})
    it("should not delete anything should there not be files in the specific director", () => {})

    afterAll(async () => {
        // Clean ceremony and user from DB.
        await adminFirestore.collection("users").doc(userId).delete()

        // Remove Auth user.
        await adminAuth.deleteUser(userId)

        // Delete admin app.
        await deleteAdminApp()
    })
})
