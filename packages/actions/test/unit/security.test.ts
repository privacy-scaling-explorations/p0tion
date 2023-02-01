import chai, { assert, expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signOut } from "firebase/auth"
import { fakeCeremoniesData, fakeUsersData } from "../data/samples"
import {
    createNewFirebaseUserWithEmailAndPw,
    deleteAdminApp,
    envType,
    generatePseudoRandomStringOfNumbers,
    initializeAdminServices,
    initializeUserServices,
    sleep
} from "../utils"
import { generateGetObjectPreSignedUrl, getCurrentFirebaseAuthUser } from "../../src"
import { TestingEnvironment } from "../../types"

chai.use(chaiAsPromised)

/**
 * Unit test for Firebase helpers.
 * @notice some of these methods are used as a core component for authentication.
 */
describe("GeneratePreSignedURL", () => {
    // Init admin services.
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp, userFunctions } = initializeUserServices()
    const userPassword = generatePseudoRandomStringOfNumbers(24)
    const user = fakeUsersData.fakeUser1

    beforeAll(async () => {
        // Development workflow: authenticate use through email/pw authentication when using the emulator.
        await createNewFirebaseUserWithEmailAndPw(userApp, user.data.email, userPassword)

        // Retrieve the current auth user in Firebase.
        const currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
        user.uid = currentAuthenticatedUser.uid

        await sleep(5000) // 5s delay.
    })

    it("should throw when given a bucket name that is not for a ceremony", async () => {
        assert.isRejected(generateGetObjectPreSignedUrl(userFunctions, "nonExistent", "test"))
    })

    // the emulator should run without .env file thus this test would not work.
    if (envType === TestingEnvironment.PRODUCTION) {
        it("should return a pre-signed URL when given the bucket name for a ceremony", async () => {
            // Create the mock data on Firestore.
            await adminFirestore
                .collection(`ceremonies`)
                .doc(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
                .set({
                    ...fakeCeremoniesData.fakeCeremonyOpenedFixed.data
                })

            const url = await generateGetObjectPreSignedUrl(
                userFunctions,
                fakeCeremoniesData.fakeCeremonyOpenedFixed.data.prefix,
                "anObject"
            )
            expect(url).to.be.a("string")
        })
    }

    it("should throw when called without being authenticated", async () => {
        await signOut(getAuth(userApp))
        assert.isRejected(generateGetObjectPreSignedUrl(userFunctions, "nonExistent", "test"))
    })

    afterAll(async () => {
        // Delete the user.
        await adminAuth.deleteUser(user.uid)
        await adminFirestore.collection("users").doc(user.uid).delete()
        // Delete the ceremony.
        await adminFirestore.collection(`ceremonies`).doc(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid).delete()
        // Delete admin app.
        await deleteAdminApp()
    })
})
