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
    sleep
} from "../utils"
import { getBucketName, createS3Bucket, objectExist, getCurrentFirebaseAuthUser, multiPartUpload } from "../../src"
import { fakeCeremoniesData, fakeCircuitsData, fakeUsersData } from "../data/samples"
import { openMultiPartUpload } from "../../src/helpers/storage"

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
        it("should throw if a user without being logged in tries to call objectExist", async () => {
            // logout
            await signOut(userAuth)
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
        it("should fail when called without being authenticated", async () => {
            await signOut(userAuth)
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
            // Create the mock data on Firestore.
            await adminFirestore
                .collection(`ceremonies`)
                .doc(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
                .set({
                    ...fakeCeremoniesData.fakeCeremonyOpenedFixed.data
                })

            await adminFirestore
                .collection(`ceremonies/${fakeCeremoniesData.fakeCeremonyOpenedFixed.uid}/circuits`)
                .doc(fakeCircuitsData.fakeCircuitSmallNoContributors.uid)
                .set({
                    ...fakeCircuitsData.fakeCircuitSmallNoContributors.data
                })
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
            await adminFirestore
                .collection(`ceremonies/${fakeCeremoniesData.fakeCeremonyOpenedFixed.uid}/circuits`)
                .doc(fakeCircuitsData.fakeCircuitSmallNoContributors.uid)
                .delete()

            await adminFirestore.collection(`ceremonies`).doc(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid).delete()
        })
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
