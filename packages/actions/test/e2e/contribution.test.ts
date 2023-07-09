import chai, { assert, expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth"
import { zKey } from "snarkjs"
import fetch from "@adobe/node-fetch-retry"
import { randomBytes } from "crypto"
import { cwd } from "process"
import fs from "fs"
import {
    getCeremonyCircuits,
    checkParticipantForCeremony,
    resumeContributionAfterTimeoutExpiration,
    formatZkeyIndex,
    getBucketName,
    getZkeyStorageFilePath,
    generateGetObjectPreSignedUrl,
    createS3Bucket,
    multiPartUpload,
    genesisZkeyIndex,
    getCircuitBySequencePosition,
    progressToNextContributionStep,
    createCustomLoggerForFile,
    permanentlyStoreCurrentContributionTimeAndHash,
    getDocumentById,
    getParticipantsCollectionPath,
    verifyContribution,
    progressToNextCircuitForContribution,
    getPotStorageFilePath,
    getTranscriptStorageFilePath,
    getCircuitsCollectionPath
} from "../../src/index"
import { fakeCeremoniesData, fakeCircuitsData, fakeUsersData } from "../data/samples"
import {
    initializeAdminServices,
    initializeUserServices,
    deleteAdminApp,
    createMockCeremony,
    cleanUpMockUsers,
    createMockParticipant,
    createMockTimedOutContribution,
    cleanUpMockTimeout,
    createMockUser,
    getStorageConfiguration,
    deleteObjectFromS3,
    deleteBucket,
    envType,
    sleep,
    getTranscriptLocalFilePath,
    generateUserPasswords,
    mockCeremoniesCleanup
} from "../utils/index"
import { generateFakeParticipant } from "../data/generators"
import { ParticipantContributionStep, ParticipantStatus, TestingEnvironment } from "../../src/types/enums"

// Config chai.
chai.use(chaiAsPromised)

describe("Contribution", () => {
    // Initialize admin and user services.
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp, userFirestore, userFunctions } = initializeUserServices()
    const userAuth = getAuth(userApp)

    const users = [fakeUsersData.fakeUser1, fakeUsersData.fakeUser2, fakeUsersData.fakeUser3]
    const passwords = generateUserPasswords(users.length)

    let ceremonyBucketPostfix: string = ""
    let streamChunkSizeInMb: number = 0

    if (envType === TestingEnvironment.PRODUCTION) {
        const { ceremonyBucketPostfix: postfix, streamChunkSizeInMb: size } = getStorageConfiguration()
        ceremonyBucketPostfix = postfix
        streamChunkSizeInMb = size
    }

    const zkeyPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_0000.zkey`
    const potPath = `${cwd()}/packages/actions/test/data/artifacts/powersOfTau28_hez_final_02.ptau`

    const ceremony = fakeCeremoniesData.fakeCeremonyOpenedFixed
    const tmpCircuit = fakeCircuitsData.fakeCircuitSmallNoContributors
    const ceremonyId = ceremony.uid
    const bucketName = getBucketName(ceremony.data.prefix, ceremonyBucketPostfix)

    let storagePath = getZkeyStorageFilePath(
        tmpCircuit.data.prefix!,
        `${tmpCircuit.data.prefix}_${genesisZkeyIndex}.zkey`
    )

    const potStoragePath = getPotStorageFilePath(tmpCircuit.data.files?.potFilename!)

    let transcriptStoragePath: string = ""
    let transcriptLocalFilePath: string = ""
    let lastZkeyLocalFilePath: string = ""
    let nextZkeyLocalFilePath: string = ""

    const outputDirectory = `${cwd()}/packages/actions/test/data/artifacts/output`

    if (envType === TestingEnvironment.PRODUCTION) {
        // create dir structure
        fs.mkdirSync(`${outputDirectory}/contribute/attestation`, { recursive: true })
        fs.mkdirSync(`${outputDirectory}/contribute/transcripts`, { recursive: true })
        fs.mkdirSync(`${outputDirectory}/contribute/zkeys`, { recursive: true })
    }
    // s3 objects we have to delete
    const objectsToDelete = [potStoragePath, storagePath]

    beforeAll(async () => {
        // @note this test suite needs some delay if run after other
        // test suites
        await sleep(1000)

        // Create users
        for (let i = 0; i < users.length; i++) {
            users[i].uid = await createMockUser(
                userApp,
                users[i].data.email,
                passwords[i],
                i === passwords.length - 2, // middle one is coordinator
                adminAuth
            )
        }

        await sleep(10000) // wait for custom claims.

        // Create the mock data on Firestore (ceremony)
        await createMockCeremony(
            adminFirestore,
            fakeCeremoniesData.fakeCeremonyOpenedFixed,
            fakeCircuitsData.fakeCircuitSmallNoContributors
        )

        if (envType === TestingEnvironment.PRODUCTION) {
            // create a bucket and upload data
            // sign in as coordinator
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            await createS3Bucket(userFunctions, bucketName)
            await sleep(1000)
            // zkey upload
            await multiPartUpload(userFunctions, bucketName, storagePath, zkeyPath, streamChunkSizeInMb)
            // pot upload
            await multiPartUpload(userFunctions, bucketName, potStoragePath, potPath, streamChunkSizeInMb)
            await signOut(userAuth)
        }

        // create mock ceremony with circuit data
        await createMockCeremony(adminFirestore, ceremony, tmpCircuit)
    })
    // @note figure out how to clean up transcripts
    if (envType === TestingEnvironment.PRODUCTION) {
        it("should allow an authenticated user to contribute to a ceremony", async () => {
            // 1. login as user 2
            await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
            await sleep(500)
            // 2. get circuits for ceremony
            const circuits = await getCeremonyCircuits(userFirestore, ceremonyId)
            expect(circuits.length).to.be.gt(0)

            // 3. register for cermeony
            const canParticipate = await checkParticipantForCeremony(userFunctions, ceremonyId)
            expect(canParticipate).to.be.true

            // 4. entropy
            const entropy = randomBytes(32).toString("hex")

            // 5. get circuit to contribute to
            const circuit = getCircuitBySequencePosition(circuits, 1)
            expect(circuit).not.be.null

            // 6. get circuit data
            const currentProgress = circuit.data.waitingQueue.completedContributions
            const currentZkeyIndex = formatZkeyIndex(currentProgress)
            const nextZkeyIndex = formatZkeyIndex(currentProgress + 1)

            // 7. download previous contribution
            storagePath = getZkeyStorageFilePath(circuit.data.prefix, `${circuit.data.prefix}_${currentZkeyIndex}.zkey`)

            lastZkeyLocalFilePath = `${outputDirectory}/contribute/zkeys/${circuit.data.prefix}_${currentZkeyIndex}.zkey`
            nextZkeyLocalFilePath = `${outputDirectory}/contribute/zkeys/${circuit.data.prefix}_${nextZkeyIndex}.zkey`

            const preSignedUrl = await generateGetObjectPreSignedUrl(userFunctions, bucketName, storagePath)
            // @ts-ignore
            const getResponse = await fetch(preSignedUrl)
            await sleep(500)
            // Write the file to disk.
            fs.writeFileSync(lastZkeyLocalFilePath, await getResponse.buffer())
            await sleep(1000)
            // 9. progress to next step
            await progressToNextCircuitForContribution(userFunctions, ceremonyId)
            await sleep(2000)

            transcriptLocalFilePath = `${outputDirectory}/${getTranscriptLocalFilePath(
                `${circuit.data.prefix}_${nextZkeyIndex}.log`
            )}`
            const transcriptLogger = createCustomLoggerForFile(transcriptLocalFilePath)
            // 10. do contribution
            await zKey.contribute(lastZkeyLocalFilePath, nextZkeyLocalFilePath, users[2].uid, entropy, transcriptLogger)
            await sleep(2000)

            // read the contribution hash
            const transcriptContents = fs.readFileSync(transcriptLocalFilePath, "utf-8").toString()
            const matchContributionHash = transcriptContents.match(/Contribution.+Hash.+\n\t\t.+\n\t\t.+\n.+\n\t\t.+\n/)
            const contributionHash = matchContributionHash?.at(0)?.replace("\n\t\t", "")!

            await progressToNextContributionStep(userFunctions, ceremonyId)
            await sleep(2000)
            await permanentlyStoreCurrentContributionTimeAndHash(
                userFunctions,
                ceremonyId,
                new Date().valueOf(),
                contributionHash
            )
            await sleep(3000)

            await progressToNextContributionStep(userFunctions, ceremonyId)
            await sleep(1000)

            const participant = await getDocumentById(
                userFirestore,
                getParticipantsCollectionPath(ceremonyId),
                users[2].uid
            )

            // Upload
            const nextZkeyStoragePath = getZkeyStorageFilePath(
                circuit.data.prefix,
                `${circuit.data.prefix}_${nextZkeyIndex}.zkey`
            )
            await multiPartUpload(
                userFunctions,
                bucketName,
                nextZkeyStoragePath,
                nextZkeyLocalFilePath,
                streamChunkSizeInMb,
                ceremony.uid,
                participant.data()!.tempContributionData
            )
            await sleep(1000)

            objectsToDelete.push(nextZkeyStoragePath)

            // Execute contribution verification.
            const tempCircuit = await getDocumentById(
                userFirestore,
                getCircuitsCollectionPath(ceremonyId),
                tmpCircuit.uid
            )

            await verifyContribution(
                userFunctions,
                ceremonyId,
                tempCircuit,
                bucketName,
                users[2].uid,
                String(process.env.FIREBASE_CF_URL_VERIFY_CONTRIBUTION)
            )
            // TODO Get validity from latest contribution.
            // expect(valid).to.be.true

            // compute the transcript hash
            const transcriptFullName = `${tmpCircuit.data.prefix}_${nextZkeyIndex}_${users[2].uid}_verification_transcript.log`
            transcriptStoragePath = getTranscriptStorageFilePath(tmpCircuit.data.prefix!, transcriptFullName)
            objectsToDelete.push(transcriptStoragePath)
        })
    }
    /// @note a contributor authenticates, however they fail to contribute in time to a ceremony
    /// and they are locked out of the ceremony
    it("should block a contributor that is idle when contributing", async () => {
        // create locked out participant
        await createMockTimedOutContribution(
            adminFirestore,
            users[1].uid,
            fakeCeremoniesData.fakeCeremonyOpenedFixed.uid
        )
        const ceremonyUID = fakeCeremoniesData.fakeCeremonyOpenedFixed.uid
        // use user 2
        await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
        const result = await checkParticipantForCeremony(userFunctions, ceremonyUID)
        expect(result).to.be.false

        await cleanUpMockTimeout(adminFirestore, ceremonyUID, users[1].uid)
    })
    /// @note after being locked out, they will be able to resume their contribution
    it("should allow a participant to resume a contribution after their locked status is removed", async () => {
        // mock timeout
        const participantContributing = generateFakeParticipant({
            uid: users[0].uid,
            data: {
                userId: users[0].uid,
                contributionProgress: 1,
                contributionStep: ParticipantContributionStep.COMPUTING,
                status: ParticipantStatus.EXHUMED,
                contributions: [],
                lastUpdated: Date.now(),
                contributionStartedAt: Date.now() - 100,
                verificationStartedAt: Date.now(),
                tempContributionData: {
                    contributionComputationTime: Date.now() - 100,
                    uploadId: "001",
                    chunks: []
                }
            }
        })

        await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])

        await createMockParticipant(
            adminFirestore,
            fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
            users[0].uid,
            participantContributing
        )

        await assert.isFulfilled(
            resumeContributionAfterTimeoutExpiration(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
        )
    })
    /// @note a contributor authenticates, and tries to call the resume contribution function
    /// however this fails as they were not locked out
    it("should fail to resume a contribution on a ceremony where the user is not timed out", async () => {
        // mock timeout
        const participantContributing = generateFakeParticipant({
            uid: users[0].uid,
            data: {
                userId: users[0].uid,
                contributionProgress: 1,
                contributionStep: ParticipantContributionStep.COMPUTING,
                status: ParticipantStatus.WAITING,
                contributions: [],
                lastUpdated: Date.now(),
                contributionStartedAt: Date.now() - 100,
                verificationStartedAt: Date.now(),
                tempContributionData: {
                    contributionComputationTime: Date.now() - 100,
                    uploadId: "001",
                    chunks: []
                }
            }
        })

        await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])

        await createMockParticipant(
            adminFirestore,
            fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
            users[0].uid,
            participantContributing
        )

        await expect(
            resumeContributionAfterTimeoutExpiration(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
        ).to.be.rejectedWith("Unable to progress to next circuit for contribution")
    })

    afterAll(async () => {
        // Clean ceremony and user from DB.
        await cleanUpMockUsers(adminAuth, adminFirestore, users)
        await mockCeremoniesCleanup(adminFirestore)

        // Delete admin app.
        await deleteAdminApp()

        if (envType === TestingEnvironment.PRODUCTION) {
            // clean up S3 bucket and objects
            objectsToDelete.forEach(async (object) => {
                await deleteObjectFromS3(bucketName, object)
            })
            await sleep(2000)
            await deleteBucket(bucketName)

            if (fs.existsSync(outputDirectory)) fs.rmSync(outputDirectory, { recursive: true, force: true })
        }
    })
})
