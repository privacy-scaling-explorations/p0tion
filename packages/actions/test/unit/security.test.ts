import chai, { assert, expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import {
    getAuth,
    signOut,
    signInWithEmailAndPassword,
    OAuthCredential,
    GithubAuthProvider,
    signInAnonymously
} from "firebase/auth"
import { where } from "firebase/firestore"
import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device"
import { randomBytes } from "crypto"
import { fakeCeremoniesData, fakeCircuitsData, fakeUsersData } from "../data/samples"
import {
    deleteAdminApp,
    envType,
    initializeAdminServices,
    initializeUserServices,
    generateUserPasswords,
    createMockUser,
    cleanUpMockUsers,
    getAuthenticationConfiguration,
    cleanUpMockCeremony,
    createMockCeremony
} from "../utils"
import {
    commonTerms,
    generateGetObjectPreSignedUrl,
    getCurrentFirebaseAuthUser,
    isCoordinator,
    signInToFirebaseWithCredentials
} from "../../src"
import { TestingEnvironment } from "../../src/types/enums"
import { getDocumentById, queryCollection } from "../../src/helpers/database"
import { simulateOnVerification } from "../utils/authentication"

chai.use(chaiAsPromised)

/**
 * Test suite for the security rules and vulnerabilities fixes.
 */
describe("Security", () => {
    // Global config
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp, userFunctions, userFirestore } = initializeUserServices()
    const userAuth = getAuth(userApp)

    const users = [fakeUsersData.fakeUser1, fakeUsersData.fakeUser2, fakeUsersData.fakeUser3]
    const passwords = generateUserPasswords(users.length)

    beforeAll(async () => {
        for (let i = 0; i < users.length; i++) {
            users[i].uid = await createMockUser(
                userApp,
                users[i].data.email,
                passwords[i],
                i === users.length - 1, // last one is coordinator
                adminAuth
            )
        }
    })

    describe("GeneratePreSignedURL", () => {
        beforeAll(async () => {
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed,
                fakeCircuitsData.fakeCircuitSmallNoContributors
            )
        })
        it("should throw when given a bucket name that is not used for a ceremony", async () => {
            assert.isRejected(generateGetObjectPreSignedUrl(userFunctions, "nonExistent", "test"))
        })

        // the emulator should run without .env file thus this test would not work.
        if (envType === TestingEnvironment.PRODUCTION) {
            it("should return a pre-signed URL when given the bucket name for a ceremony", async () => {
                const url = await generateGetObjectPreSignedUrl(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.data.prefix,
                    "anObject"
                )
                /* eslint-disable no-useless-escape */
                const regex =
                    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/
                expect(url).to.match(regex)
            })
        }

        it("should throw when called without being authenticated", async () => {
            await signOut(getAuth(userApp))
            assert.isRejected(generateGetObjectPreSignedUrl(userFunctions, "nonExistent", "test"))
        })

        afterAll(async () => {
            if (envType === TestingEnvironment.PRODUCTION)
                // Delete the ceremony.
                await cleanUpMockCeremony(
                    adminFirestore,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    fakeCircuitsData.fakeCircuitSmallNoContributors.uid
                )
        })
    })

    describe("Security rules", () => {
        it("should allow a user to retrieve their own data from the firestore db", async () => {
            // login as user1
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const userDoc = await getDocumentById(userFirestore, commonTerms.collections.users.name, users[0].uid)
            expect(userDoc.data()).to.not.be.null
        })

        it("should allow any authenticated user to query the ceremony collection", async () => {
            // login as user2
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            // query the ceremonies collection
            expect(
                await queryCollection(userFirestore, commonTerms.collections.ceremonies.name, [
                    where(commonTerms.collections.ceremonies.fields.description, "!=", "")
                ])
            ).to.not.throw
        })

        it("should throw an error if a coordinator tries to read another user's document", async () => {
            // login as coordinator
            await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
            // retrieve the document of another user
            assert.isRejected(getDocumentById(userFirestore, commonTerms.collections.users.name, users[0].uid))
        })

        it("should throw an error if an authenticated user tries to read another user's data", async () => {
            // login as user2
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            assert.isRejected(getDocumentById(userFirestore, commonTerms.collections.users.name, users[0].uid))
        })

        afterEach(async () => {
            // Make sure to sign out.
            await signOut(userAuth)
        })
    })

    // Tests related to authentication security
    describe("Authentication", () => {
        const clientType = "oauth-app"
        const tokenType = "oauth"

        // Get and assign configs.
        const { githubClientId } = getAuthenticationConfiguration()
        const clientId = githubClientId

        let userId: string = ""

        it("should not let anyone authenticate with the wrong password", async () => {
            const wrongPassword = "wrongPassword"
            expect(signInWithEmailAndPassword(userAuth, users[0].data.email, wrongPassword)).to.be.rejectedWith(
                "Firebase: Error (auth/wrong-password)."
            )
        })
        if (envType === TestingEnvironment.PRODUCTION) {
            it("should not allow to authenticate anynomously to Firebase", async () => {
                const auth = getAuth()
                await expect(signInAnonymously(auth)).to.be.rejectedWith(
                    "Firebase: Error (auth/admin-restricted-operation)."
                )
            })
            it("should prevent authentication with the wrong OAuth2 token", async () => {
                await expect(signInToFirebaseWithCredentials(userApp, new OAuthCredential())).to.be.rejectedWith(
                    "Firebase: Invalid IdP response/credential: http://localhost?&providerId=undefined (auth/invalid-credential-or-provider-id)."
                )
            })
            // @todo might not be able to test this in code since it requires revoking access on GitHub
            it.skip("should not be able to authenticate with a token after this is invalidated", async () => {
                const auth = createOAuthDeviceAuth({
                    clientType,
                    clientId,
                    scopes: ["gist"],
                    onVerification: simulateOnVerification
                })
                const { token } = await auth({
                    type: tokenType
                })
                // Get and exchange credentials.
                const userFirebaseCredentials = GithubAuthProvider.credential(token)
                await signInToFirebaseWithCredentials(userApp, userFirebaseCredentials)
                const user = getCurrentFirebaseAuthUser(userApp)
                userId = user.uid

                await signOut(userAuth)

                // @todo how to revoke the token programmatically?
                await signInToFirebaseWithCredentials(userApp, userFirebaseCredentials)
            })
            // @todo add checks to cloud function
            it("should prevent a user with a non reputable GitHub account from authenticating to the Firebase", async () => {})
            it("should prevent a disabled account from loggin in (OAuth2)", async () => {
                const auth = createOAuthDeviceAuth({
                    clientType,
                    clientId,
                    scopes: ["gist"],
                    onVerification: simulateOnVerification
                })
                const { token } = await auth({
                    type: tokenType
                })
                // Get and exchange credentials.
                const userFirebaseCredentials = GithubAuthProvider.credential(token)
                await signInToFirebaseWithCredentials(userApp, userFirebaseCredentials)

                const user = getCurrentFirebaseAuthUser(userApp)
                userId = user.uid
                // Disable user.
                const disabledRecord = await adminAuth.updateUser(user.uid, { disabled: true })
                expect(disabledRecord.disabled).to.be.true

                await signOut(userAuth)

                await expect(signInToFirebaseWithCredentials(userApp, userFirebaseCredentials)).to.be.rejectedWith(
                    "Firebase: Error (auth/user-disabled)."
                )
            })
        }
        // @todo document this feature to prevent enumeration attacks
        it.skip("should not allow a user to enumerate valid emails", async () => {
            // @link https://cloud.google.com/identity-platform/docs/admin/email-enumeration-protection
            const wrongPassword = "wrongPassword"
            const wrongEmail = "wrongEmail"
            expect(signInWithEmailAndPassword(userAuth, wrongEmail, wrongPassword)).to.not.be.rejectedWith(
                "Firebase: Error (auth/invalid-email)."
            )
            expect(signInWithEmailAndPassword(userAuth, users[1].data.email, wrongPassword)).to.not.be.rejectedWith(
                "Firebase: Error (auth/wrong-password)."
            )
        })
        it.skip("should rate limit after a large number of failed attempts", async () => {
            let err: any
            try {
                for (let i = 0; i < 1000; i++) {
                    await expect(signInToFirebaseWithCredentials(userApp, new OAuthCredential())).to.be.rejectedWith(
                        "Firebase: Invalid IdP response/credential: http://localhost?&providerId=undefined (auth/invalid-credential-or-provider-id)."
                    )
                }
            } catch (error: any) {
                err = error
            }
            expect(err).to.not.be.undefined
        })
        it("getCurrentFirebaseAuthUser should retun the current authenticated user and not another user's data", async () => {
            // login as user1
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
            expect(currentAuthenticatedUser.uid).to.equal(users[0].uid)
        })
        it("should not set a user as coordinator when they are not", async () => {
            // login as user1
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
            expect(await isCoordinator(currentAuthenticatedUser)).to.be.false
        })
        it("should not allow disabled accounts to login (email/password auth)", async () => {
            // Disable user.
            const disabledRecord = await adminAuth.updateUser(users[1].uid, { disabled: true })
            expect(disabledRecord.disabled).to.be.true

            // Try to authenticate with the disabled user.
            await expect(signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])).to.be.rejectedWith(
                "Firebase: Error (auth/user-disabled)."
            )

            // re enable the user
            const recordReset = await adminAuth.updateUser(users[1].uid, {
                disabled: false
            })
            expect(recordReset.disabled).to.be.false
        })
        // this test should be running last
        if (envType === TestingEnvironment.PRODUCTION) {
            it("should lock out an account after a large number of failed attempts", async () => {
                let err: any
                for (let i = 0; i < 1000; i++) {
                    try {
                        await signInWithEmailAndPassword(userAuth, users[0].data.email, randomBytes(10).toString("hex"))
                    } catch (error: any) {
                        if (error.toString() !== "FirebaseError: Firebase: Error (auth/wrong-password).") {
                            err = error.toString()
                            break
                        }
                    }
                }
                expect(err).to.be.eq(
                    "FirebaseError: Firebase: Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later. (auth/too-many-requests)."
                )
            })
        }
        afterAll(async () => {
            // Clean OAuth user
            if (userId) {
                await adminFirestore.collection(commonTerms.collections.users.name).doc(userId).delete()
                await adminAuth.deleteUser(userId)
            }
        })
    })

    // general clean up after all tests
    afterAll(async () => {
        // Clean user from DB.
        await cleanUpMockUsers(adminAuth, adminFirestore, users)
        // Delete admin app.
        await deleteAdminApp()
    })
})
