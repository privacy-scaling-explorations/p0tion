import chai, { expect, assert } from "chai"
import chaiAsPromised from "chai-as-promised"
import { randomBytes } from "crypto"
import { getAuth, signInWithEmailAndPassword } from "firebase/auth"
import {
    initializeAdminServices,
    initializeUserServices,
    getStorageConfiguration,
    generatePseudoRandomStringOfNumbers,
    createNewFirebaseUserWithEmailAndPw,
    deleteAdminApp,
    sleep,
    addCoordinatorPrivileges
} from "../utils"
import { fakeCeremoniesData, fakeUsersData } from "../data/samples"
import { getBucketName, createS3Bucket, getCurrentFirebaseAuthUser, multiPartUpload, objectExist } from "../../src"

// Config chai.
chai.use(chaiAsPromised)

describe.skip("Setup", () => {
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
        const ceremonyData = fakeCeremoniesData.fakeCeremonyOpenedDynamic

        // Should return the bucket name.
        const bucket = getBucketName(ceremonyBucketPostfix, ceremonyData.data.prefix)

        assert.isRejected(createS3Bucket(userFunctions, bucket))
    })

    it("should successfully create a s3 bucket when logged in as coordinator", async () => {
        // login with coordinator creds
        await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)

        // Should return the bucket name.
        const bucket = randomBytes(24).toString("hex")

        const res = await createS3Bucket(userFunctions, bucket)
        expect(res).to.be.true
    })
    it("should revert when trying to create a ceremony with an existing prefix", async () => {
        // login with coordinator creds
        await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
        // Create once
        const bucket = randomBytes(24).toString("hex")
        const res = await createS3Bucket(userFunctions, bucket)
        expect(res).to.be.true
        // Create again
        assert.isRejected(createS3Bucket(userFunctions, bucket))
    })
    it("should create a new ceremony", async () => {})
    it("should revert when given a malformed r1cs file", async () => {})
    it("should upload a file to s3", async () => {})
    it("should fail to upload to a non existent bucket", async () => {
        assert.isRejected(
            multiPartUpload(
                userFunctions,
                randomBytes(20).toString("hex"), // random bucket name
                "zkey.zkey",
                "./test/data/zkey.zkey",
                process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB!,
                Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS!),
                "ceremony"
            )
        )
    })
    it("should close a multi part upload", async () => {})
    it.skip("should do a full multi part upload", async () => {
        // 1. create bucket
        const name = randomBytes(20).toString("hex")
        await createS3Bucket(userFunctions, name)

        // 2. multi part upload
        const objectName = "zkey.zkey"
        await multiPartUpload(
            userFunctions,
            name,
            objectName,
            "./test/data/zkey.zkey",
            process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB!,
            Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS!),
            "ceremony"
        )

        // 3. check that the file was uploaded correctly
        expect(await objectExist(userFunctions, name, objectName)).to.be.true
    })
    it("should return true for an existing object inside a bucket", async () => {})
    it("should return false for an non existing object inside a bucket", async () => {
        // 1. create bucket
        const name = randomBytes(20).toString("hex")
        await createS3Bucket(userFunctions, name)
        // 2.check existence
        expect(await objectExist(userFunctions, name, randomBytes(20).toString("hex"))).to.be.false
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

        // Delete admin app.
        await deleteAdminApp()
    })
})
