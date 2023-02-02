import chai, { expect, assert } from "chai"
import chaiAsPromised from "chai-as-promised"
import { randomBytes } from "crypto"
import fs from "fs"
import { getAuth, signInWithEmailAndPassword } from "firebase/auth"
import {
    initializeAdminServices,
    initializeUserServices,
    getStorageConfiguration,
    generatePseudoRandomStringOfNumbers,
    createNewFirebaseUserWithEmailAndPw,
    deleteAdminApp,
    sleep,
    addCoordinatorPrivileges,
    deleteBucket,
    deleteObjectFromS3,
    envType
} from "../utils"
import { fakeCeremoniesData, fakeUsersData } from "../data/samples"
import { getBucketName, createS3Bucket, getCurrentFirebaseAuthUser, multiPartUpload } from "../../src"
import { TestingEnvironment } from "../../src/types/enums"

// Config chai.
chai.use(chaiAsPromised)

describe("Setup", () => {
    // Sample data for running the test.
    const user = fakeUsersData.fakeUser2
    const coordinatorEmail = "coordinator@coordinator.com"
    // storing the uid so we can delete the user after the test
    let coordinatorUid: string

    // generate passwords for user and coordinator
    const userPwd = generatePseudoRandomStringOfNumbers(24)
    const coordinatorPwd = generatePseudoRandomStringOfNumbers(24)

    // Initialize user and admin services.
    const { userApp, userFunctions } = initializeUserServices()
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const userAuth = getAuth(userApp)

    // Get configs for storage.
    const { ceremonyBucketPostfix } = getStorageConfiguration()
    const ceremonyData = fakeCeremoniesData.fakeCeremonyScheduledFixed
    const bucketName = getBucketName(ceremonyData.data.prefix, ceremonyBucketPostfix)
    // file to upload
    const localPath = "/tmp/circuitMetadata.log"
    fs.writeFileSync(localPath, "test data")
    const objectName = "zkey.zkey"
    const duplicateBucketName = randomBytes(10).toString("hex")

    beforeAll(async () => {
        // create a new user without contributor privileges
        await createNewFirebaseUserWithEmailAndPw(userApp, user.data.email, userPwd)
        await sleep(5000)

        // Retrieve the current auth user in Firebase.
        const currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
        user.uid = currentAuthenticatedUser.uid

        // create account for coordinator
        await createNewFirebaseUserWithEmailAndPw(userApp, coordinatorEmail, coordinatorPwd)
        await sleep(5000)

        const currentAuthenticatedCoordinator = getCurrentFirebaseAuthUser(userApp)
        coordinatorUid = currentAuthenticatedCoordinator.uid

        // add custom claims
        await addCoordinatorPrivileges(adminAuth, coordinatorUid)
    })

    it("should fail to create a sample ceremony without being a coordinator", async () => {
        await signInWithEmailAndPassword(userAuth, user.data.email, userPwd)
        assert.isRejected(createS3Bucket(userFunctions, bucketName))
    })

    // run these tests only in production mode
    if (envType === TestingEnvironment.PRODUCTION) {
        it("should revert when trying to create a ceremony with an existing prefix", async () => {
            // login with coordinator creds
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
            const currentAuthenticatedCoordinator = getCurrentFirebaseAuthUser(userApp)
            // refresh token
            await currentAuthenticatedCoordinator.getIdToken(true)
            // Create once
            const res = await createS3Bucket(userFunctions, duplicateBucketName)
            expect(res).to.be.true
            // Create again
            assert.isRejected(createS3Bucket(userFunctions, duplicateBucketName))
        })

        it("should do a full multi part upload", async () => {
            // make sure we are logged in as coordinator
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
            // 1. create bucket
            await createS3Bucket(userFunctions, bucketName)

            // 2. multi part upload
            const success = await multiPartUpload(
                userFunctions,
                bucketName,
                objectName,
                localPath,
                process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128",
                Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS) || 3600
            )

            expect(success).to.be.true
        })
    }

    it("should fail to create a new ceremony when given the wrong path to a zkey", async () => {
        // make sure we are logged in as coordinator
        await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)

        // 2. multi part upload
        assert.isRejected(
            multiPartUpload(
                userFunctions,
                bucketName,
                objectName,
                "./nonExistantPath.zkey",
                process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128",
                Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS) || 3600
            )
        )
    })

    it("should create a new ceremony", async () => {
        // @todo waiting for template based ceremony creation
    })

    afterAll(async () => {
        // Clean ceremony and user from DB.
        await adminFirestore.collection("users").doc(user.uid).delete()
        await adminFirestore.collection("users").doc(coordinatorUid).delete()
        // Remove Auth user.
        await adminAuth.deleteUser(user.uid)
        await adminAuth.deleteUser(coordinatorUid)
        // Delete admin app.
        await deleteAdminApp()
        // delete buckets and objects
        // emulator safe as they return false if no .env file is present
        await deleteObjectFromS3(bucketName, objectName)
        await deleteBucket(bucketName)
        await deleteBucket(duplicateBucketName)
        // remove file
        fs.unlinkSync(localPath)
    })
})
