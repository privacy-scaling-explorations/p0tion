import chai, { assert, expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth"
import { randomBytes } from "crypto"
import {
    addCoordinatorPrivileges,
    createNewFirebaseUserWithEmailAndPw,
    deleteAdminApp,
    generatePseudoRandomStringOfNumbers,
    initializeAdminServices,
    initializeUserServices,
    sleep,
    deleteBucket,
    cleanUpMockCeremony,
    createMockCeremony,
    addParticipantPrivileges
} from "../utils"
import { fakeUsersData } from "../data/samples"
import { getBucketName, createS3Bucket, objectExist, getCurrentFirebaseAuthUser, multiPartUpload } from "../../src"
import { getChunksAndPreSignedUrls, openMultiPartUpload } from "../../src/helpers/storage"

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
        it("should return the correct bucket name", () => {
            expect(getBucketName("Test", ceremonyPostfix)).to.be.equal("Test-mpc-dev")
            expect(getBucketName("Test", "")).to.be.equal("Test")
        })
    })

    describe("createS3Bucket", () => {
        const bucketName = randomBytes(10).toString("hex")
        it("should fail to create a bucket when not logged in", async () => {
            await signOut(userAuth)
            assert.isRejected(createS3Bucket(userFunctions, bucketName))
        })
        it("should create a bucket", async () => {
            // login with coordinator creds
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
            // make sure coordinator privileges have been added (could be removed by cloud function)
            await addCoordinatorPrivileges(adminAuth, coordinatorUid)
            // refresh token
            const currentAuthenticatedCoordinator = getCurrentFirebaseAuthUser(userApp)
            await currentAuthenticatedCoordinator.getIdToken(true)
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
        // clean up
        afterAll(async () => {
            await deleteBucket(bucketName)
        })
    })

    describe("objectExist", () => {
        const bucketName = randomBytes(10).toString("hex")
        const objectName = randomBytes(10).toString("hex")
        beforeAll(async () => {
            // login as coordinator
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
            // create bucket
            await createS3Bucket(userFunctions, bucketName)
            // logout to reset state
            await signOut(userAuth)
        })
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
        it("should throw if a user without being logged in tries to call objectExist", async () => {
            // logout
            await signOut(userAuth)
            // execute function
            assert.isRejected(objectExist(userFunctions, bucketName, objectName))
        })
        it("should return true if the object exists", async () => {
            // login as coordinator
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
            // upload file
            // check existence
        })
        it("should not work if given an invalid userFunctions parameter", async () => {
            const test: any = {}
            assert.isRejected(objectExist(test, bucketName, objectName))
        })
        afterAll(async () => {
            await deleteBucket(bucketName)
        })
    })

    describe("multiPartUpload", () => {
        it("should fail when called without being authenticated", async () => {
            await signOut(userAuth)
            assert.isRejected(multiPartUpload(userFunctions, "bucketName", "objectName", "localPath", "test", 5))
        })
        it("should fail when providing a non-existent bucket name", async () => {
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
            assert.isRejected(multiPartUpload(userFunctions, "bucketName", "objectName", "localPath", "test", 5))
        })
        it.skip("should allow any users to call the function", async () => {
            await signInWithEmailAndPassword(userAuth, user.data.email, userPassword)
            assert.isFulfilled(multiPartUpload(userFunctions, "bucketName", "objectName", "localPath", "test", 5))
        })
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
        const bucketName = randomBytes(10).toString("hex")
        beforeAll(async () => {
            // login as coordinator
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
            // create the bucket
            await createS3Bucket(userFunctions, bucketName)
            // logout
            await signOut(userAuth)

            // add mock ceremony data
            await createMockCeremony(adminFirestore)
        })
        it("should successfully open a multi part upload when provided the correct parameters", async () => {
            // login as coordinator
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)

            const id = await openMultiPartUpload(userFunctions, bucketName, "objectKey")
            expect(id).to.not.be.null
        })
        it("should fail to open a multi part upload when provided the wrong parameters", async () => {
            // login as coordinator
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)

            assert.isRejected(openMultiPartUpload({} as any, bucketName, "objectKey"))
        })
        it("should fail to open a multi part upload when provided a non existent bucket", async () => {
            // login as coordinator
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)

            assert.isRejected(openMultiPartUpload(userFunctions, "nonExistentBucket", "objectKey"))
        })
        it("should not allow a contributor to open a multi part upload when not providing a ceremony Id parameter", async () => {
            // login as contributor
            await signInWithEmailAndPassword(userAuth, user.data.email, userPassword)

            assert.isRejected(openMultiPartUpload(userFunctions, bucketName, "objectKey"))
        })
        it("should fail when calling without being authenticated", async () => {
            // logout
            await signOut(userAuth)

            assert.isRejected(openMultiPartUpload(userFunctions, bucketName, "objectKey"))
        })
        it("should allow a contributor to open a multi part upload when providing a ceremony Id parameter", async () => {})

        afterAll(async () => {
            await deleteBucket(bucketName)
            await cleanUpMockCeremony(adminFirestore)
        })
    })

    describe("getChunksAndPreSignedUrls", () => {
        const bucketName = randomBytes(10).toString("hex")
        let multiPartUploadId: string
        const objectKey = "circuitMetadata.json"
        const localPath = "./packages/actions/test/data/circuitMetadata.log"
        beforeAll(async () => {
            // login as coordinator
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
            // create the bucket
            await createS3Bucket(userFunctions, bucketName)
            // Create the mock data on Firestore.
            await createMockCeremony(adminFirestore)
            // create multi part upload
            multiPartUploadId = await openMultiPartUpload(userFunctions, bucketName, "objectKey")
            expect(multiPartUploadId).to.not.be.null
            // logout
            await signOut(userAuth)
        })
        it("should successfully get the preSignedUrls when provided the correct parameters (connected as a coordinator)", async () => {
            // login as coordinator
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
            const chunksWithUrlsZkey = await getChunksAndPreSignedUrls(
                userFunctions,
                bucketName,
                objectKey,
                localPath,
                multiPartUploadId,
                Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS || 7200),
                process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128"
            )
            expect(chunksWithUrlsZkey[0].preSignedUrl).to.not.be.null
            await signOut(userAuth)
        })
        it.skip("should fail to get the preSignedUrls when provided an incorrect multi part upload ID", async () => {
            // @todo add validation on backend to check if the multiPartUploadId is valid or that a bucket exists
            // before calling the cloud function that interacts with S3
            // login as coordinator
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
            assert.isRejected(
                getChunksAndPreSignedUrls(
                    userFunctions,
                    "nonExistentBucket",
                    "nonExistentObjectKey",
                    localPath,
                    "nonExistentMultiPartUploadId",
                    Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS || 7200),
                    process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128"
                )
            )
            await signOut(userAuth)
        })
        it.skip("should allow any authenticated user to call getChunksAndPreSignedUrls", async () => {
            // sign in as contributor
            await signInWithEmailAndPassword(userAuth, user.data.email, userPassword)
            // @todo why is this not working? debug below
            await addParticipantPrivileges(adminAuth, user.uid)
            // refresh token
            const currentAuthenticatedParticipant = getCurrentFirebaseAuthUser(userApp)
            await currentAuthenticatedParticipant.getIdToken(true)
            // ensure we have participant privileges
            const data = await currentAuthenticatedParticipant.getIdTokenResult()
            expect(data.claims.participant).to.be.true

            // should work
            const chunksWithUrlsZkey = await getChunksAndPreSignedUrls(
                userFunctions,
                bucketName,
                objectKey,
                localPath,
                multiPartUploadId,
                Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS || 7200),
                process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128"
            )
            expect(chunksWithUrlsZkey[0].preSignedUrl).to.not.be.null
        })
        it("should fail when calling without being authenticated", async () => {
            // make sure we are logged out
            await signOut(userAuth)
            assert.isRejected(
                getChunksAndPreSignedUrls(
                    userFunctions,
                    bucketName,
                    objectKey,
                    localPath,
                    multiPartUploadId,
                    Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS || 7200),
                    process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128"
                )
            )
        })
        afterAll(async () => {
            await deleteBucket(bucketName)
            await cleanUpMockCeremony(adminFirestore)
        })
    })

    describe("uploadParts", () => {
        const bucketName = randomBytes(10).toString("hex")
        let multiPartUploadId: string
        beforeAll(async () => {
            // login as coordinator
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
            // create the bucket
            await createS3Bucket(userFunctions, bucketName)
            // create the mock data on Firestore.
            await createMockCeremony(adminFirestore)
            // open the multi part upload
            multiPartUploadId = await openMultiPartUpload(userFunctions, bucketName, "objectKey")
            expect(multiPartUploadId).to.not.be.null
            // logout
            await signOut(userAuth)
        })
        it("should successfully upload the file part when provided the correct parameters", async () => {})
        it("should fail to upload the file part when provided the wrong parameters", async () => {})
        it("should allow any authenticated user to call uploadParts", async () => {})
        it("should fail when calling without being authenticated", async () => {})
        afterAll(async () => {
            await deleteBucket(bucketName)
            await cleanUpMockCeremony(adminFirestore)
        })
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
