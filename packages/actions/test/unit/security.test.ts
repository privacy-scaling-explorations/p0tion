import chai, { assert, expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signOut, signInWithEmailAndPassword } from "firebase/auth"
import { where } from "firebase/firestore"
import { fakeCeremoniesData, fakeUsersData } from "../data/samples"
import {
    createNewFirebaseUserWithEmailAndPw,
    deleteAdminApp,
    envType,
    generatePseudoRandomStringOfNumbers,
    initializeAdminServices,
    initializeUserServices,
    sleep,
    setCustomClaims
} from "../utils"
import { commonTerms, generateGetObjectPreSignedUrl, getCurrentFirebaseAuthUser } from "../../src"
import { TestingEnvironment } from "../../src/types/enums"
import { getDocumentById, queryCollection } from "../../src/helpers/database"

chai.use(chaiAsPromised)

/**
 * Test suite for the security rules and vulnerabilities fixes.
 */
describe("Security", () => {
    // Global config
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp, userFunctions, userFirestore } = initializeUserServices()
    const userAuth = getAuth(userApp)
    const user1 = fakeUsersData.fakeUser1
    const user2 = fakeUsersData.fakeUser2
    const user3 = fakeUsersData.fakeUser3
    const user1Pwd = generatePseudoRandomStringOfNumbers(24)
    const user2Pwd = generatePseudoRandomStringOfNumbers(24)
    const user3Pwd = generatePseudoRandomStringOfNumbers(24)

    beforeAll(async () => {
        // create 1st user
        await createNewFirebaseUserWithEmailAndPw(userApp, user1.data.email, user1Pwd)
        await sleep(5000)

        // Retrieve the current auth user in Firebase.
        let currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
        user1.uid = currentAuthenticatedUser.uid

        // create 2nd user
        await createNewFirebaseUserWithEmailAndPw(userApp, user2.data.email, user2Pwd)
        await sleep(5000)

        // Retrieve the current auth user in Firebase.
        currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
        user2.uid = currentAuthenticatedUser.uid

        // create the coordinator
        await createNewFirebaseUserWithEmailAndPw(userApp, user3.data.email, user3Pwd)
        await sleep(5000)

        currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
        user3.uid = currentAuthenticatedUser.uid

        // add coordinator privileges
        await setCustomClaims(adminAuth, user3.uid, { coordinator: true })
    })

    describe("GeneratePreSignedURL", () => {
        it("should throw when given a bucket name that is not used for a ceremony", async () => {
            assert.isRejected(generateGetObjectPreSignedUrl(userFunctions, "nonExistent", "test"))
        })

        // the emulator should run without .env file thus this test would not work.
        if (envType === TestingEnvironment.PRODUCTION) {
            it("should return a pre-signed URL when given the bucket name for a ceremony", async () => {
                // Create the mock data on Firestore.
                await adminFirestore
                    .collection(commonTerms.collections.ceremonies.name)
                    .doc(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
                    .set({
                        ...fakeCeremoniesData.fakeCeremonyOpenedFixed.data
                    })

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
                await adminFirestore
                    .collection(commonTerms.collections.ceremonies.name)
                    .doc(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
                    .delete()
        })
    })

    describe("Security rules", () => {
        it("should allow a user to retrieve their own data from the firestore db", async () => {
            // login as user1
            await signInWithEmailAndPassword(userAuth, user1.data.email, user1Pwd)
            const userDoc = await getDocumentById(userFirestore, commonTerms.collections.users.name, user1.uid)
            expect(userDoc.data()).to.not.be.null
        })

        it("should allow any authenticated user to query the ceremony collection", async () => {
            // login as user2
            await signInWithEmailAndPassword(userAuth, user2.data.email, user2Pwd)
            // query the ceremonies collection
            expect(
                await queryCollection(userFirestore, commonTerms.collections.ceremonies.name, [
                    where(commonTerms.collections.ceremonies.fields.description, "!=", "")
                ])
            ).to.not.throw
        })

        it("should throw an error if a coordiantor tries to read another user's document", async () => {
            // login as coordinator
            await signInWithEmailAndPassword(userAuth, user3.data.email, user3Pwd)
            // retrieve the document of another user
            assert.isRejected(getDocumentById(userFirestore, commonTerms.collections.users.name, user1.uid))
        })

        it("should throw an error if an authenticated user tries to read another user's data", async () => {
            // login as user2
            await signInWithEmailAndPassword(userAuth, user2.data.email, user2Pwd)
            assert.isRejected(getDocumentById(userFirestore, commonTerms.collections.users.name, user1.uid))
        })

        afterEach(async () => {
            // Make sure to sign out.
            await signOut(userAuth)
        })
    })

    // general clean up after all tests
    afterAll(async () => {
        // Clean user from DB.
        await adminFirestore.collection("users").doc(user1.uid).delete()
        await adminFirestore.collection("users").doc(user2.uid).delete()
        await adminFirestore.collection("users").doc(user3.uid).delete()
        // Remove Auth user.
        await adminAuth.deleteUser(user1.uid)
        await adminAuth.deleteUser(user2.uid)
        await adminAuth.deleteUser(user3.uid)
        // Delete admin app.
        await deleteAdminApp()
    })
})
