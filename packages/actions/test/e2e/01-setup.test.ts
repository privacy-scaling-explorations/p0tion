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
    setCustomClaims,
    deleteBucket,
    deleteObjectFromS3,
    envType
} from "../utils"
import { fakeCeremoniesData, fakeCircuitsData, fakeUsersData } from "../data/samples"
import {
    getBucketName,
    createS3Bucket,
    getCurrentFirebaseAuthUser,
    multiPartUpload,
    getZkeyStorageFilePath,
    getPotStorageFilePath,
    getR1csStorageFilePath,
    setupCeremony
} from "../../src"
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

        // add custom claims for coordinator
        await setCustomClaims(adminAuth, coordinatorUid, { coordinator: true })
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
            await createS3Bucket(userFunctions, duplicateBucketName)
            await sleep(5000)
            // Create again
            expect(createS3Bucket(userFunctions, duplicateBucketName)).to.be.rejectedWith("Failed request.")
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

        it("should create a new ceremony", async () => {
            // make sure we are logged in as coordinator
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)

            const ceremony = fakeCeremoniesData.fakeCeremonyScheduledDynamic
            const ceremonyBucket = getBucketName(ceremony.data.prefix, `-${randomBytes(5).toString("hex")}`)
            const circuit = fakeCircuitsData.fakeCircuitSmallNoContributors
            // 1 create a bucket for the ceremony
            await createS3Bucket(userFunctions, ceremonyBucket)

            // 2. upload zkey
            const zkeyLocalFilePath = "/tmp/circuit.zkey"
            fs.writeFileSync(zkeyLocalFilePath, "zkey")

            const zkeyStorageFilePath = getZkeyStorageFilePath(circuit.data.prefix!, "circuit_00001.zkey")

            await multiPartUpload(
                userFunctions,
                bucketName,
                zkeyStorageFilePath,
                zkeyLocalFilePath,
                String(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB),
                Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS)
            )

            // 3. upload pot
            const potLocalFilePath = "/tmp/circuit.pot"
            fs.writeFileSync(potLocalFilePath, "pot")

            const potStorageFilePath = getPotStorageFilePath("testpot.pot")
            await multiPartUpload(
                userFunctions,
                bucketName,
                potStorageFilePath,
                potLocalFilePath,
                String(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB),
                Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS)
            )

            // 4. upload r1cs
            const r1csLocalFilePath = "/tmp/circuit.r1cs"
            fs.writeFileSync(r1csLocalFilePath, "r1cs")

            const r1csStorageFilePath = getR1csStorageFilePath(circuit.data.prefix!, "circuit_00001.r1cs")
            await multiPartUpload(
                userFunctions,
                bucketName,
                r1csStorageFilePath,
                r1csLocalFilePath,
                String(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB),
                Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS)
            )

            // 5. setup ceremony
            await setupCeremony(userFunctions, ceremony.data, ceremony.data.prefix!, [circuit.data])

            // 6. confirm
            const ceremonyDoc = await adminFirestore.collection("ceremonies").doc(ceremony.uid).get()
            expect(ceremonyDoc.data()).to.not.be.null

            // clean up
            await deleteObjectFromS3(ceremonyBucket, zkeyStorageFilePath)
            await deleteObjectFromS3(ceremonyBucket, potStorageFilePath)
            await deleteObjectFromS3(ceremonyBucket, r1csStorageFilePath)
            await deleteBucket(ceremonyBucket)
            fs.unlinkSync(zkeyLocalFilePath)
            fs.unlinkSync(potLocalFilePath)
            fs.unlinkSync(r1csLocalFilePath)
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
