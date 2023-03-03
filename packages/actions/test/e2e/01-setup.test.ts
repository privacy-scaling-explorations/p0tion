import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { randomBytes } from "crypto"
import fs from "fs"
import { getAuth, signInWithEmailAndPassword } from "firebase/auth"
import {
    initializeAdminServices,
    initializeUserServices,
    getStorageConfiguration,
    generateUserPasswords,
    deleteAdminApp,
    sleep,
    deleteBucket,
    deleteObjectFromS3,
    envType,
    createMockUser,
    cleanUpMockUsers,
    getZkeyLocalFilePath,
    getPotLocalFilePath,
    cleanUpMockCeremony
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
    setupCeremony,
    genesisZkeyIndex,
    potFilenameTemplate,
    commonTerms,
    getDocumentById,
    getCeremonyCircuits,
    checkIfObjectExist
} from "../../src"
import { CeremonyState, TestingEnvironment } from "../../src/types/enums"

// Config chai.
chai.use(chaiAsPromised)

describe("Setup", () => {
    // Sample data for running the test.
    const users = [fakeUsersData.fakeUser1, fakeUsersData.fakeUser2]
    const passwords = generateUserPasswords(2)

    // Initialize user and admin services.
    const { userApp, userFunctions, userFirestore } = initializeUserServices()
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const userAuth = getAuth(userApp)

    // Get configs for storage.
    const { ceremonyBucketPostfix, streamChunkSizeInMb } = getStorageConfiguration()
    const ceremony = fakeCeremoniesData.fakeCeremonyScheduledDynamic
    const ceremonyBucket = getBucketName(ceremony.data.prefix, ceremonyBucketPostfix)
    const duplicateBucketName = randomBytes(10).toString("hex")
    const circuit = fakeCircuitsData.fakeCircuitSmallNoContributors

    const setupFolder = `./${commonTerms.foldersAndPathsTerms.output}/${commonTerms.foldersAndPathsTerms.setup}`
    const potFolder = `${setupFolder}/${commonTerms.foldersAndPathsTerms.pot}`
    const zkeyFolder = `${setupFolder}/${commonTerms.foldersAndPathsTerms.zkeys}`

    const zkeyName = `${circuit.data.prefix}_${genesisZkeyIndex}.zkey`
    const zkeyLocalFilePath = getZkeyLocalFilePath(zkeyName)
    const zkeyStorageFilePath = getZkeyStorageFilePath(circuit.data.prefix!, zkeyName)

    const potName = `${potFilenameTemplate}3.pot`
    const potLocalFilePath = getPotLocalFilePath(potName)
    const potStorageFilePath = getPotStorageFilePath(potName)

    const r1csName = `${circuit.data.prefix}.r1cs`
    const r1csLocalFilePath = `./${r1csName}`
    const r1csStorageFilePath = getR1csStorageFilePath(circuit.data.prefix!, r1csName)

    let ceremonyId: string
    let circuitId: string

    // create folders
    fs.mkdirSync(potFolder, { recursive: true })
    fs.mkdirSync(zkeyFolder, { recursive: true })

    beforeAll(async () => {
        // create 2 users the second is the coordinator
        for (let i = 0; i < 2; i++) {
            users[i].uid = await createMockUser(
                userApp,
                users[i].data.email,
                passwords[i],
                i === passwords.length - 1,
                adminAuth
            )
        }
    })

    it("should fail to create a ceremony without being a coordinator", async () => {
        await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
        await expect(createS3Bucket(userFunctions, ceremonyBucket)).to.be.rejectedWith(
            "You do not have privileges to perform this operation."
        )
    })

    // run these tests only in production mode
    if (envType === TestingEnvironment.PRODUCTION) {
        it("should revert when trying to create a ceremony with an existing prefix", async () => {
            // @todo this test will need more work and possible refactoring of cloud functions
            // login with coordinator creds
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            const currentAuthenticatedCoordinator = getCurrentFirebaseAuthUser(userApp)
            // refresh token
            await currentAuthenticatedCoordinator.getIdToken(true)
            // Create once
            await createS3Bucket(userFunctions, duplicateBucketName)
            await sleep(5000)
            // Create again
            await expect(createS3Bucket(userFunctions, duplicateBucketName)).to.be.rejectedWith("Failed request.")
        })

        it("should create a new ceremony", async () => {
            // make sure we are logged in as coordinator
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])

            // 1 create a bucket for the ceremony
            await createS3Bucket(userFunctions, ceremonyBucket)

            // 2. upload zkey
            fs.writeFileSync(zkeyLocalFilePath, "zkey")
            await multiPartUpload(
                userFunctions,
                ceremonyBucket,
                zkeyStorageFilePath,
                zkeyLocalFilePath,
                streamChunkSizeInMb
            )

            // 3. upload pot
            fs.writeFileSync(potLocalFilePath, "pot")
            await multiPartUpload(
                userFunctions,
                ceremonyBucket,
                potStorageFilePath,
                potLocalFilePath,
                streamChunkSizeInMb
            )

            // 4. upload r1cs
            fs.writeFileSync(r1csLocalFilePath, "r1cs")
            await multiPartUpload(
                userFunctions,
                ceremonyBucket,
                r1csStorageFilePath,
                r1csLocalFilePath,
                streamChunkSizeInMb
            )

            // 5. setup ceremony
            ceremonyId = await setupCeremony(userFunctions, ceremony.data, ceremony.data.prefix!, [circuit.data])

            // 6. confirm
            const ceremonyDoc = await getDocumentById(
                userFirestore,
                commonTerms.collections.ceremonies.name,
                ceremonyId
            )
            const ceremonyData = ceremonyDoc.data()
            // confirm ceremony
            expect(ceremonyData?.state).to.be.eq(CeremonyState.SCHEDULED)
            expect(ceremonyData?.timeoutType).to.be.eq(ceremony.data.timeoutMechanismType)
            expect(ceremonyData?.endDate).to.be.eq(ceremony.data.endDate)
            expect(ceremonyData?.prefix).to.be.eq(ceremony.data.prefix)
            expect(ceremonyData?.penalty).to.be.eq(ceremony.data.penalty)
            expect(ceremonyData?.type).to.be.eq(ceremony.data.type)
            expect(ceremonyData?.description).to.be.eq(ceremony.data.description)
            expect(ceremonyData?.coordinatorId).to.be.eq(users[1].uid)
            expect(ceremonyData?.startDate).to.be.eq(ceremony.data.startDate)
            expect(ceremonyData?.lastUpdated).to.be.lt(Date.now().valueOf())

            const circuits = await getCeremonyCircuits(userFirestore, ceremonyId)
            const circuitCreated = circuits[0]
            circuitId = circuitCreated.id
            // confirm circuits
            expect(circuitCreated.data.zKeySizeInBytes).to.be.eq(circuit.data.zKeySizeInBytes)
            expect(circuitCreated.data.prefix).to.be.eq(circuit.data.prefix)
            expect(circuitCreated.data.name).to.be.eq(circuit.data.name)
            expect(circuitCreated.data.description).to.be.eq(circuit.data.description)
            expect(circuitCreated.data.sequencePosition).to.be.eq(circuit.data.sequencePosition)
            expect(circuitCreated.data.fixedTimeWindow).to.be.eq(circuit.data.fixedTimeWindow)
            expect(circuitCreated.data.lastUpdated).to.lt(Date.now().valueOf())

            // check on s3
            expect(await checkIfObjectExist(userFunctions, ceremonyBucket, zkeyStorageFilePath)).to.be.true
            expect(await checkIfObjectExist(userFunctions, ceremonyBucket, potStorageFilePath)).to.be.true
            expect(await checkIfObjectExist(userFunctions, ceremonyBucket, r1csStorageFilePath)).to.be.true
        })
        it("should fail to create a new ceremony when the coordinator provides the wrong path to a file required for a ceremony setup (zkey)", async () => {
            const objectName = "test_upload.zkey"
            const nonExistentLocalPath = "./nonExistentPath.zkey"
            // make sure we are logged in as coordinator
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])

            // 2. multi part upload
            await expect(
                multiPartUpload(userFunctions, ceremonyBucket, objectName, nonExistentLocalPath, streamChunkSizeInMb)
            ).to.be.rejectedWith("ENOENT: no such file or directory")
        })
    }

    afterAll(async () => {
        // Clean user from DB.
        await cleanUpMockUsers(adminAuth, adminFirestore, users)
        if (envType === TestingEnvironment.PRODUCTION) {
            // delete buckets and objects
            // emulator safe as they return false if no .env file is present
            await deleteObjectFromS3(ceremonyBucket, zkeyStorageFilePath)
            await deleteObjectFromS3(ceremonyBucket, potStorageFilePath)
            await deleteObjectFromS3(ceremonyBucket, r1csStorageFilePath)
            await deleteBucket(ceremonyBucket)
            await deleteBucket(duplicateBucketName)
            // clean up ceremony
            await cleanUpMockCeremony(adminFirestore, ceremonyId, circuitId)
        }

        // delete folders
        fs.rmSync(zkeyFolder, { recursive: true })
        fs.rmSync(potFolder, { recursive: true })
        fs.rmSync(setupFolder, { recursive: true })
        fs.rmSync(commonTerms.foldersAndPathsTerms.output, { recursive: true })

        // Delete admin app.
        await deleteAdminApp()
    })
})
