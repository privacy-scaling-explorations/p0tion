import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device"
import { expect } from "chai"
import { FirebaseApp } from "firebase/app"
import { GithubAuthProvider } from "firebase/auth"
import { getCurrentFirebaseAuthUser, signInToFirebaseWithCredentials } from "../../src/index"
import {
    createNewFirebaseUserWithEmailAndPw,
    deleteAdminApp,
    envType,
    generatePseudoRandomStringOfNumbers,
    getAuthenticationConfiguration,
    initializeAdminServices,
    initializeUserServices,
    simulateOnVerification
} from "../utils"
import { TestingEnvironment } from "../../types"
import { fakeUsersData } from "../data/samples"

/**
 * E2E authentication tests.
 */
describe("Authentication", () => {
    // Prepare all necessary data to execute the e2e scenario flow.
    let firebaseUserApp: FirebaseApp
    let userEmailAddress: string
    let userUid: string

    // Init admin services.
    const { adminFirestore, adminAuth } = initializeAdminServices()

    beforeAll(async () => {
        // Get and assign configs.
        const { userApp } = initializeUserServices()
        firebaseUserApp = userApp
    })

    if (envType === TestingEnvironment.PRODUCTION)
        /**
         * Remote production workflow
         * These tests are going to simulate the interaction between the user and the Github Device Flow using
         * a web scraper tool. We have tested only GMail accounts associated to Github.
         * In fact, to retrieve the OTP verification codes from GMail you'll need to enable the GMail OAuth2.0 APIs.
         * Also, do not enable 2FA on your Github or GMail account.
         * Please, configure accordingly the environments.
         *
         * NB. USE ONLY TESTING ACCOUNTS, NOT YOUR REAL ACCOUNTS.
         */
        describe("Production", () => {
            let clientId: string
            const clientType = "oauth-app"
            const tokenType = "oauth"

            beforeAll(async () => {
                // Get and assign configs.
                const { githubClientId, userEmail } = getAuthenticationConfiguration()
                clientId = githubClientId
                userEmailAddress = userEmail

                const { userApp } = initializeUserServices()
                firebaseUserApp = userApp
            })

            it("authenticate a new user using Github OAuth 2.0 device flow", async () => {
                // Create OAuth 2.0 with Github.
                const auth = createOAuthDeviceAuth({
                    clientType,
                    clientId,
                    scopes: ["gist"],
                    onVerification: simulateOnVerification
                })

                // Get the access token.
                const { token } = await auth({
                    type: tokenType
                })

                // Get and exchange credentials.
                const userFirebaseCredentials = GithubAuthProvider.credential(token)
                await signInToFirebaseWithCredentials(firebaseUserApp, userFirebaseCredentials)

                // Retrieve the current auth user in Firebase.
                const currentAuthUser = getCurrentFirebaseAuthUser(firebaseUserApp)

                // Then.
                expect(token).lengthOf(40)
                expect(token.startsWith("gho_")).to.be.equal(true)
                expect(currentAuthUser.uid.length > 0).to.be.equal(true)
                expect(userFirebaseCredentials.accessToken).to.be.equal(token)

                // Anchor for freeing up resources after tests.
                userUid = currentAuthUser.uid
            })
        })
    /**
     * Development local workflow
     * These tests run on the Firebase Emulator. The Authentication service of the emulator do not support
     * 3rd party OAuth login. Therefore, we are going to use the email and a randomly generated password
     * to authenticate the user in the emulated environment. This kind of tests do not reproduce any Device Flow
     * Github or any OAuth 2.0. These tests are useful for quickly test the ceremony workflows besides the authentication.
     * These tests do not use secrets. Please, refer to the production tests for the real Firebase Authentication service test.
     */ else
        describe("Development", () => {
            beforeAll(async () => {
                // Get and assign configs.
                userEmailAddress = fakeUsersData.fakeUser1.data.email
            })

            it("authenticate a new user using email and password", async () => {
                // Development workflow: authenticate use through email/pw authentication when using the emulator.
                const userFirebaseCredentials = await createNewFirebaseUserWithEmailAndPw(
                    firebaseUserApp,
                    userEmailAddress,
                    generatePseudoRandomStringOfNumbers(24)
                )

                // Retrieve the current auth user in Firebase.
                const currentAuthUser = getCurrentFirebaseAuthUser(firebaseUserApp)
                userUid = currentAuthUser.uid

                expect(currentAuthUser.uid.length > 0).to.be.equal(true)
                expect(userFirebaseCredentials.user.uid).to.be.equal(currentAuthUser.uid)
                expect(userFirebaseCredentials.user.email).to.be.equal(currentAuthUser.email)
            })
        })

    it("should not be possible to authenticate twice", async () => {})

    it("should not be possible to authenticate if the user refuses to associate its Github account", async () => {})

    it("should not be possible to authenticate if the user send an expired device token", async () => {})

    it("should not be possible to authenticate if Github is unreachable", async () => {})

    it("should not be possible to authenticate if Firebase is unreachable", async () => {})

    it("should not be possible to authenticate if the user has been disabled from the Authentication service by coordinator", async () => {})

    afterAll(async () => {
        // Finally: revert the state back to pre-given state. This section is executed even if when or then fails.
        // Clean  user from DB.
        await adminFirestore.collection("users").doc(userUid).delete()

        // Remove Auth user.
        await adminAuth.deleteUser(userUid)

        // Delete admin app.
        await deleteAdminApp()
    })
})
