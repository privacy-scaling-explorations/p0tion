import chai, { assert, expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword } from "firebase/auth"
import { randomBytes } from "crypto"
import {
    addCoordinatorPrivileges,
    createNewFirebaseUserWithEmailAndPw,
    deleteAdminApp,
    generatePseudoRandomStringOfNumbers,
    initializeAdminServices,
    initializeUserServices,
    sleep
} from "../utils"
import { getBucketName, createS3Bucket, objectExist, getCurrentFirebaseAuthUser } from "../../src"
import { fakeUsersData } from "../data/samples"

chai.use(chaiAsPromised)

describe("Storage", () => {
    const user = fakeUsersData.fakeUser1
    const coordinatorEmail = "coordinator@coordinator.com"
    // storing the uid so we can delete the user after the test
    let coordinatorUid: string

    const { adminFirestore, adminAuth } = initializeAdminServices()

    const { userApp, userFunctions } = initializeUserServices()
    const userAuth = getAuth(userApp)
    const userPassword = generatePseudoRandomStringOfNumbers(24)
    const coordinatorPwd = generatePseudoRandomStringOfNumbers(24)

    const ceremonyPostfix = "-mpc-dev"
    beforeAll(async () => {
        // create a new user without contributor privileges
        await createNewFirebaseUserWithEmailAndPw(userApp, user.data.email, userPassword)

        await sleep(5000)

        // Retrieve the current auth user in Firebase.
        const currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
        user.uid = currentAuthenticatedUser.uid

        // create account for coordinator
        await createNewFirebaseUserWithEmailAndPw(userApp, coordinatorEmail, coordinatorPwd)

        await sleep(5000)

        const currentAuthenticatedCoordinator = getCurrentFirebaseAuthUser(userApp)
        coordinatorUid = currentAuthenticatedCoordinator.uid
        await addCoordinatorPrivileges(adminAuth, coordinatorUid)
    })

    describe("getBucketName", () => {
        it("should return the bucket name", () => {
            const bucketName = getBucketName("Test", ceremonyPostfix)
            expect(bucketName).to.be.equal("Test-mpc-dev")
        })
    })

    describe("createS3Bucket", () => {
        const bucketName = randomBytes(10).toString("hex")
        it("should create a bucket", async () => {
            // login with coordinator creds
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
            const success = await createS3Bucket(userFunctions, bucketName)
            expect(success).to.be.equal(true)
        })
        it("should fail to create a bucket with a name that exists already", async () => {
            // login with coordinator creds
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
            assert.isRejected(createS3Bucket(userFunctions, bucketName))
        })
        it("should fail to create a bucket when not logged in as a coordinator", async () => {
            // login as contributor
            await signInWithEmailAndPassword(userAuth, user.data.email, userPassword)
            assert.isRejected(createS3Bucket(userFunctions, bucketName))
        })
    })

    describe("objectExist", () => {
        const bucketName = randomBytes(10).toString("hex")
        const objectName = randomBytes(10).toString("hex")
        it("should return false if the object does not exist", async () => {
            // login as coordinator
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
            // execute function
            const exists = await objectExist(userFunctions, bucketName, objectName)
            expect(exists).to.be.equal(false)
        })
        it("should throw if a user without coordinator privileges tries to call objectExist", async () => {
            // login as contributor
            await signInWithEmailAndPassword(userAuth, user.data.email, userPassword)
            // execute function
            assert.isRejected(objectExist(userFunctions, bucketName, objectName))
        })
        it("should return true if the object exists", async () => {
            // login as coordinator
            // upload file
            // check existence
        })
        it("should not work if given an invalid userFunctions parameter", async () => {
            const test: any = {}
            assert.isRejected(objectExist(test, bucketName, objectName))
        })
    })

    describe("multiPartUpload", () => {
        it("should start a multi part upload given the correct parameters", async () => {})
        it("should fail when called without being authenticated", async () => {})
        it("should allow any users to call the function", async () => {})
    })

    describe("generateGetObjectPreSignedUrl", () => {
        it("should generate the pre signed URL for an existing object", async () => {})
        it("should fail to generate the pre signed URL for a non existing object", async () => {})
        it("should not be possible to call this function when not authenticated", async () => {})
    })

    describe("uploadFileToStorage", () => {
        it("should allow any user to upload a file to storage", async () => {})
        it("should not overwrite a stored user from another user", async () => {})
        it("should fail to upload a file to storage if the user is not logged in", async () => {})
        it("should fail to upload a file to storage if given a wrong local path", async () => {})
    })

    describe("openMultiPartUpload", () => {
        it("should successfully open a multi part upload when provided the correct parameters", async () => {})
        it("should fail to open a multi part upload when provided the wrong parameters", async () => {})
        it("should allow any authenticated user to call openMultiPartUpload", async () => {})
        it("should fail when calling without being authenticated", async () => {})
    })

    describe("getChunksAndPreSignedUrls", () => {
        it("should successfully get the preSignedUrls when provided the correct parameters", async () => {})
        it("should fail to get the preSignedUrls of a non existent object", async () => {})
        it("should allow any authenticated user to call getChunksAndPreSignedUrls", async () => {})
        it("should fail when calling without being authenticated", async () => {})
    })

    describe("uploadParts", () => {
        it("should successfully upload the file part when provided the correct parameters", async () => {})
        it("should fail to upload the file part when provided the wrong parameters", async () => {})
        it("should allow any authenticated user to call uploadParts", async () => {})
        it("should fail when calling without being authenticated", async () => {})
    })

    describe("closeMultiPartUpload", () => {
        it("should successfully close the multi part upload when provided the correct parameters", async () => {})
        it("should fail to close the multi part upload when provided the wrong parameters", async () => {})
        it("should allow any authenticated user to call closeMultiPartUpload", async () => {})
        it("should fail when calling without being authenticated", async () => {})
    })

    afterAll(async () => {
        if (user) {
            // Clean ceremony and user from DB.
            await adminFirestore.collection("users").doc(user.uid).delete()

            // Remove Auth user.
            await adminAuth.deleteUser(user.uid)
        }
        if (coordinatorUid) {
            // Remove coordinator from DB.
            await adminFirestore.collection("users").doc(coordinatorUid).delete()
            // Remove Auth user.
            await adminAuth.deleteUser(coordinatorUid)
        }

        await deleteAdminApp()
    })
})
