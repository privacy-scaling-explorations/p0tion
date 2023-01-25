import { expect } from "chai"
import { getCurrentFirebaseAuthUser, getDocumentById } from "../../src/index"
import {
    createNewFirebaseUserWithEmailAndPw,
    deleteAdminApp,
    generatePseudoRandomStringOfNumbers,
    initializeAdminServices,
    initializeUserServices,
    sleep
} from "../utils"
import { fakeUsersData } from "../data/samples"

/*
 * E2E authentication tests.
 */
describe("Authentication", () => {
    // Prepare all necessary data to execute the e2e scenario flow.
    const user = fakeUsersData.fakeUser1

    // Init admin services.
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp, userFirestore } = initializeUserServices()

    it("authenticate a new user using email and password", async () => {
        // Development workflow: authenticate use through email/pw authentication when using the emulator.
        const userFirebaseCredentials = await createNewFirebaseUserWithEmailAndPw(
            userApp,
            user.data.email,
            generatePseudoRandomStringOfNumbers(24)
        )

        // Retrieve the current auth user in Firebase.
        const currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
        user.uid = currentAuthenticatedUser.uid

        // Await until data has been written on Firestore data by cloud functions.
        // TODO: try to retrieve data in a cleaner way (maybe async listener?).
        await sleep(5000) // 5s delay.

        const userDoc = await getDocumentById(userFirestore, "users", user.uid)
        const data = userDoc.data()

        expect(currentAuthenticatedUser.email).to.be.equal(user.data.email)
        expect(currentAuthenticatedUser.email).to.be.equal(data?.email)
        expect(currentAuthenticatedUser.emailVerified).to.be.equal(user.data.emailVerified)
        expect(currentAuthenticatedUser.emailVerified).to.be.equal(data?.emailVerified)
        expect(currentAuthenticatedUser.displayName).to.be.null // due to mail/pw provider.
        expect(currentAuthenticatedUser.displayName).to.be.equal(data?.displayName)
        expect(currentAuthenticatedUser.photoURL).to.be.null // due to mail/pw provider.
        expect(data?.photoURL).to.be.empty // due to mail/pw provider.
        expect(new Date(String(currentAuthenticatedUser.metadata.creationTime)).valueOf()).to.be.equal(
            new Date(String(userFirebaseCredentials.user.metadata.creationTime)).valueOf()
        )
        expect(new Date(String(currentAuthenticatedUser.metadata.lastSignInTime)).valueOf()).to.be.equal(
            new Date(String(userFirebaseCredentials.user.metadata.lastSignInTime)).valueOf()
        )
    })

    it("should not be possible to authenticate twice", async () => {})

    it("should not be possible to authenticate if the user refuses to associate its Github account", async () => {})

    it("should not be possible to authenticate if the user send an expired device token", async () => {})

    it("should not be possible to authenticate if Github is unreachable", async () => {})

    it("should not be possible to authenticate if Firebase is unreachable", async () => {})

    it("should not be possible to authenticate if the user has been disabled from the Authentication service by coordinator", async () => {})

    afterAll(async () => {
        // Clean user from DB.
        await adminFirestore.collection("users").doc(user.uid).delete()

        // Remove Auth user.
        await adminAuth.deleteUser(user.uid)

        // Delete admin app.
        await deleteAdminApp()
    })
})

// Production ready tests using puppeteer.
// Currently under maintainance due to unknown Github authentication restriction.
// if (envType === TestingEnvironment.PRODUCTION)
// /**
//  * Remote production workflow
//  * These tests are going to simulate the interaction between the user and the Github Device Flow using
//  * a web scraper tool. We have tested only GMail accounts associated to Github.
//  * In fact, to retrieve the OTP verification codes from GMail you'll need to enable the GMail OAuth2.0 APIs.
//  * Also, do not enable 2FA on your Github or GMail account.
//  * Please, configure accordingly the environments.
//  *
//  * NB. USE ONLY TESTING ACCOUNTS, NOT YOUR REAL ACCOUNTS.
//  */
// describe("Production", () => {
//     let clientId: string
//     const clientType = "oauth-app"
//     const tokenType = "oauth"

//     beforeAll(async () => {
//         // Get and assign configs.
//         const { githubClientId, userEmail } = getAuthenticationConfiguration()
//         clientId = githubClientId
//         userEmailAddress = userEmail

//         const { userApp } = initializeUserServices()
//         firebaseUserApp = userApp
//     })

//     it("authenticate a new user using Github OAuth 2.0 device flow", async () => {
//         // Create OAuth 2.0 with Github.
//         const auth = createOAuthDeviceAuth({
//             clientType,
//             clientId,
//             scopes: ["gist"],
//             onVerification: simulateOnVerification
//         })

//         // Get the access token.
//         const { token } = await auth({
//             type: tokenType
//         })

//         // Get and exchange credentials.
//         const userFirebaseCredentials = GithubAuthProvider.credential(token)
//         await signInToFirebaseWithCredentials(firebaseUserApp, userFirebaseCredentials)

//         // Retrieve the current auth user in Firebase.
//         const currentAuthUser = getCurrentFirebaseAuthUser(firebaseUserApp)

//         // Then.
//         expect(token).lengthOf(40)
//         expect(token.startsWith("gho_")).to.be.equal(true)
//         expect(currentAuthUser.uid.length > 0).to.be.equal(true)
//         expect(userFirebaseCredentials.accessToken).to.be.equal(token)

//         // Anchor for freeing up resources after tests.
//         userUid = currentAuthUser.uid
//     })
// })
/**
 * Email/PW Auth workflow.
 * These tests run on the Firebase Emulator and on Production (due to Github auth protection rules).
 * The Authentication service of the emulator do not support 3rd party OAuth login.
 * Therefore, we are going to use the email and a randomly generated password to authenticate the user
 * in the emulated environment. This kind of tests do not reproduce any Device Flow Github or any OAuth 2.0.
 * These tests are useful for quickly test the ceremony workflows besides the authentication.
 * These tests do not use secrets and do not test the 3rd party workflow.
 */
// describe("Development", () => {
