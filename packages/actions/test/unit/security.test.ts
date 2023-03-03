import chai, { expect } from "chai"
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

    /// @note pre conditions for production tests
    if (envType === TestingEnvironment.PRODUCTION) {
        if (
            !process.env.AUTH_GITHUB_CLIENT_ID ||
            !process.env.AUTH_USER_EMAIL ||
            !process.env.AUTH_GITHUB_USER_PW ||
            !process.env.AUTH_GMAIL_CLIENT_ID ||
            !process.env.AUTH_GMAIL_CLIENT_SECRET ||
            !process.env.AUTH_GMAIL_REDIRECT_URL ||
            !process.env.AUTH_GMAIL_REFRESH_TOKEN
        )
            throw new Error("Missing environment variables for Firebase tests.")
    }

    // create users for all tests
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
        // we need one ceremony
        beforeAll(async () => {
            await createMockCeremony(
                adminFirestore,
                fakeCeremoniesData.fakeCeremonyOpenedFixed,
                fakeCircuitsData.fakeCircuitSmallNoContributors
            )
        })
        /// @note it should not be possible to get a pre-signed URL for arbitrary objects
        /// the requested objects should be within a bucket created for a ceremony only
        /// and these checks are enforced by the cloud function
        it("should throw when given a bucket name that is not used for a ceremony", async () => {
            await expect(generateGetObjectPreSignedUrl(userFunctions, "nonExistent", "test")).to.be.rejectedWith(
                "Unable to generate a pre-signed url for the given object in the provided bucket."
            )
        })
        // the emulator should run without .env file thus this test would not work.
        if (envType === TestingEnvironment.PRODUCTION) {
            /// @note it should work as expected when:
            /// 1. the user is authenticated
            /// 2. the requested object is part of a ceremony (e.g. zkey)
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
        /// @note It should not be possible to call this cloud function when not authenticated.
        it("should throw when called without being authenticated", async () => {
            await signOut(getAuth(userApp))
            await expect(generateGetObjectPreSignedUrl(userFunctions, "nonExistent", "test")).to.be.rejectedWith(
                "You are not authorized to perform this operation."
            )
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
        /// @note security rules provided with this project prevent access to other users data
        it("should allow a user to retrieve their own data from the firestore db", async () => {
            // login as user1
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const userDoc = await getDocumentById(userFirestore, commonTerms.collections.users.name, users[0].uid)
            expect(userDoc.data()).to.not.be.null
        })
        /// @note security rules provided with this project allow access to any authenticated user
        /// to query the ceremonies collection due to no sensitive data being stored in it.
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
        if (envType === TestingEnvironment.PRODUCTION) {
            /// @note security rules provided with this project prevent access to other users data even
            /// when a coordinator tries to access it
            it("should throw an error if a coordinator tries to read another user's document", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
                // retrieve the document of another user
                await expect(
                    getDocumentById(userFirestore, commonTerms.collections.users.name, users[0].uid)
                ).to.be.rejectedWith("Missing or insufficient permissions.")
            })
            /// @note security rules provided with this project prevent access to other users data
            it("should throw an error if an authenticated user tries to read another user's data", async () => {
                // login as user2
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                await expect(
                    getDocumentById(userFirestore, commonTerms.collections.users.name, users[0].uid)
                ).to.be.rejectedWith("Missing or insufficient permissions.")
            })
            /// @note unauthenticated users should not be able to access any data
            it("should prevent unauthenticated users from accessing the users collection", async () => {
                await expect(
                    getDocumentById(userFirestore, commonTerms.collections.users.name, users[0].uid)
                ).to.be.rejectedWith("Missing or insufficient permissions.")
            })
            /// @note unauthenticated users should not be able to access any data
            it("should prevent unauthenticated users from accessing the ceremonies collection", async () => {
                await expect(
                    queryCollection(userFirestore, commonTerms.collections.ceremonies.name, [
                        where(commonTerms.collections.ceremonies.fields.description, "!=", "")
                    ])
                ).to.be.rejectedWith("Missing or insufficient permissions.")
            })
        }
        // make sure to sign out
        afterEach(async () => {
            await signOut(userAuth)
        })
    })

    // Tests related to authentication security
    // @note It is recommended to run these tests
    // on their own, as they take a long time
    // and result in the authentication service being locked
    // which wil affect other test cases
    describe("Authentication", () => {
        const clientType = "oauth-app"
        const tokenType = "oauth"

        // Get and assign configs.
        const { githubClientId } = getAuthenticationConfiguration()
        const clientId = githubClientId

        let userId: string = ""

        beforeAll(async () => signOut(userAuth))

        /// @note self explanatory
        /// one user should not be able to connect with the wrong password
        it("should not let anyone authenticate with the wrong password", async () => {
            const wrongPassword = "wrongPassword"
            expect(signInWithEmailAndPassword(userAuth, users[0].data.email, wrongPassword)).to.be.rejectedWith(
                "Firebase: Error (auth/wrong-password)."
            )
            expect(() => getCurrentFirebaseAuthUser(userApp)).to.throw(
                "Unable to find the user currently authenticated with Firebase. Verify that the Firebase application is properly configured and repeat user authentication before trying again."
            )
        })
        /// @note It should not be possible to enumerate valid email addresses
        /// using the error messages returned by the server (wrong email/ wrong password)
        /// @todo This feature needs to be enabled in one account,
        /// document this feature to prevent enumeration attacks
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
        /// @note Firebase should enforce rate limiting to prevent denial of service or consumption of resources
        /// @todo check firebase settings/docs to see if this is possible
        it.skip("should rate limit after a large number of failed attempts (OAuth2)", async () => {
            let err: any
            for (let i = 0; i < 10000; i++) {
                try {
                    await signInToFirebaseWithCredentials(userApp, new OAuthCredential())
                } catch (error: any) {
                    if (
                        error.toString() !==
                        "FirebaseError: Firebase: Invalid IdP response/credential: http://localhost?&providerId=undefined (auth/invalid-credential-or-provider-id)."
                    ) {
                        err = error
                        break
                    }
                }
            }
            console.log(err)
            expect(err).to.not.be.undefined
        })
        /// @note Firebase should enforce rate limiting to prevent denial of service or consumption of resources
        /// @todo check docs to see if this is possible
        it.skip("should enforce rate limiting on the number of failed attempts (email/password)", async () => {
            let err: any
            for (let i = 0; i < 1000; i++) {
                try {
                    await signInWithEmailAndPassword(userAuth, "wrong@email.com", "wrongPassword")
                } catch (error: any) {
                    if (error.toString() !== "FirebaseError: Firebase: Error (auth/user-not-found).") {
                        err = error
                        break
                    }
                }
            }
            console.log(err)
            expect(err).to.not.be.undefined
        })
        /// @note once authenticated, we should not be able to view another user's data
        it("getCurrentFirebaseAuthUser should retun the current authenticated user and not another user's data", async () => {
            // login as user1
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
            expect(currentAuthenticatedUser.uid).to.equal(users[0].uid)
        })
        /// @note the cloud function responsible for setting custom claims, should not set a coordinator
        /// when they are not
        it("should not set a user as coordinator when they are not", async () => {
            // login as user1
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            const currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
            expect(await isCoordinator(currentAuthenticatedUser)).to.be.false
        })
        /// @note a disabled account shuold not be able to login again
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
        /// @note once logging out, it should not be possible to access authenticated
        /// functionality again (e.g. get the current user)
        it("should correctly logout an user when calling signOut", async () => {
            await signOut(userAuth)
            expect(() => getCurrentFirebaseAuthUser(userApp)).to.throw(
                "Unable to find the user currently authenticated with Firebase. Verify that the Firebase application is properly configured and repeat user authentication before trying again."
            )
        })
        /// @note these test should be running last
        if (envType === TestingEnvironment.PRODUCTION) {
            /// @note it is not recommended to allow anynomous access to firebase
            it("should not allow to authenticate anynomously to Firebase", async () => {
                const auth = getAuth()
                await expect(signInAnonymously(auth)).to.be.rejectedWith(
                    "Firebase: Error (auth/admin-restricted-operation)."
                )
            })
            /// @note it should not authenticate with a wrong OAuth2 token
            it("should prevent authentication with the wrong OAuth2 token", async () => {
                await expect(signInToFirebaseWithCredentials(userApp, new OAuthCredential())).to.be.rejectedWith(
                    "Firebase: Invalid IdP response/credential: http://localhost?&providerId=undefined (auth/invalid-credential-or-provider-id)."
                )
            })
            /// @note If a token has been invalidated, this shuold not allow to access Firebase again
            /// @todo might not be able to test this in code since it requires revoking access on GitHub
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
            /// @note A malicious user should not be able to create multiple malicious accounts
            /// to spam a ceremony
            // @todo requires adding the checks to the cloud function
            it("should prevent a user with a non reputable GitHub account from authenticating to the Firebase", async () => {})
            /// @note If a coordinator disables an account, this should not be allowed to authenticate
            /// @note test requires a working OAuth2 emulation (puppeteer)
            it.skip("should prevent a disabled account from loggin in (OAuth2)", async () => {
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

                // Re-enable user.
                // Disable user.
                const reEnabledRecord = await adminAuth.updateUser(user.uid, { disabled: false })
                expect(reEnabledRecord.disabled).to.be.false
            })
            /// @note Firebase should lock out an account after a large number of failed authentication attempts
            /// to prevent brute force attacks
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
            it.skip("should error out and prevent further authentication attempts after authenticating with the correct OAuth2 token many times (could prevent other users from authenticating)", async () => {
                let err: any
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
                for (let i = 0; i < 1000; i++) {
                    try {
                        await signInToFirebaseWithCredentials(userApp, userFirebaseCredentials)
                    } catch (error: any) {
                        err = error
                        break
                    }
                }
                expect(
                    err.toString() === "FirebaseError: Firebase: Error (auth/user-disabled)." ||
                        err.toString() === "FirebaseError: Firebase: Error (auth/network-request-failed)." ||
                        err.toString() ===
                            "FirebaseError: Firebase: Malformed response cannot be parsed from github.com for USER_INFO (auth/invalid-credential)."
                ).to.be.true
            })
            /// @note Firebase should enforce rate limiting to prevent denial of service or consumption of resources
            /// scenario where one user tries to authenticate many times consecutively with the correct details
            /// to try and block the authentication service for other users
            it.skip("should lock out an account after authenticating with the correct username/password many times (could prevent other users from authenticating)", async () => {
                let err: any
                for (let i = 0; i < 1000; i++) {
                    try {
                        await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
                    } catch (error: any) {
                        err = error
                        break
                    }
                }
                expect(err.toString()).to.be.eq(
                    "FirebaseError: Firebase: Exceeded quota for verifying passwords. (auth/quota-exceeded)."
                )
            })
        }
        // sign out after each test
        afterEach(async () => signOut(userAuth))
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
