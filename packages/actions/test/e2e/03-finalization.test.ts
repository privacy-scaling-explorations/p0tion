import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword } from "firebase/auth"
import { randomBytes } from "crypto"
import { cwd } from "process"
import {
    checkAndPrepareCoordinatorForFinalization,
    commonTerms,
    createS3Bucket,
    finalizeCeremony,
    finalizeCircuit,
    getBucketName,
    getClosedCeremonies,
    getDocumentById,
    getParticipantsCollectionPath,
    getVerificationKeyStorageFilePath,
    getVerifierContractStorageFilePath
} from "../../src"
import { fakeCeremoniesData, fakeCircuitsData, fakeUsersData } from "../data/samples"
import {
    cleanUpMockCeremony,
    cleanUpMockUsers,
    createMockCeremony,
    createMockUser,
    deleteAdminApp,
    envType,
    generateUserPasswords,
    getStorageConfiguration,
    initializeAdminServices,
    initializeUserServices,
    sleep
} from "../utils"
import { generateFakeParticipant } from "../data/generators"
import {
    CeremonyState,
    ParticipantContributionStep,
    ParticipantStatus,
    TestingEnvironment
} from "../../src/types/enums"
import {
    createMockContribution,
    createMockParticipant,
    deleteBucket,
    deleteObjectFromS3,
    uploadFileToS3
} from "../utils/storage"

// Config chai.
chai.use(chaiAsPromised)

describe("Finalization e2e", () => {
    // Initialize admin and user services.
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp, userFirestore, userFunctions } = initializeUserServices()
    const userAuth = getAuth(userApp)

    const users = [fakeUsersData.fakeUser1, fakeUsersData.fakeUser2, fakeUsersData.fakeUser3]
    const passwords = generateUserPasswords(users.length)

    const ceremonyClosed = fakeCeremoniesData.fakeCeremonyClosedDynamic
    const ceremonyOpen = fakeCeremoniesData.fakeCeremonyOpenedFixed
    const finalizizationCircuit = fakeCircuitsData.fakeCircuitSmallNoContributors
    const contributionId = randomBytes(20).toString("hex")

    const { ceremonyBucketPostfix } = getStorageConfiguration()

    const bucketName = getBucketName(ceremonyClosed.data.prefix, ceremonyBucketPostfix)

    // Filenames.
    const verificationKeyFilename = `${finalizizationCircuit?.data.prefix}_vkey.json`
    const verifierContractFilename = `${finalizizationCircuit?.data.prefix}_verifier.sol`

    const verificationKeyLocalPath = `${cwd()}/packages/actions/test/data/${
        finalizizationCircuit?.data.prefix
    }_vkey.json`
    const verifierContractLocalPath = `${cwd()}/packages/actions/test/data/${
        finalizizationCircuit?.data.prefix
    }_verifier.sol`

    // Get storage paths.
    const verificationKeyStoragePath = getVerificationKeyStorageFilePath(
        finalizizationCircuit?.data.prefix!,
        verificationKeyFilename
    )
    const verifierContractStoragePath = getVerifierContractStorageFilePath(
        finalizizationCircuit?.data.prefix!,
        verifierContractFilename
    )

    beforeAll(async () => {
        // create users
        for (let i = 0; i < users.length; i++) {
            users[i].uid = await createMockUser(
                userApp,
                users[i].data.email,
                passwords[i],
                i === passwords.length - 1,
                adminAuth
            )
        }

        // create 2 ceremonies
        await createMockCeremony(adminFirestore, ceremonyClosed, finalizizationCircuit)
        await createMockCeremony(adminFirestore, ceremonyOpen, finalizizationCircuit)

        // add coordinator final contribution
        const coordinatorParticipant = generateFakeParticipant({
            uid: users[2].uid,
            data: {
                userId: users[2].uid,
                contributionProgress: 1,
                contributionStep: ParticipantContributionStep.COMPLETED,
                status: ParticipantStatus.DONE,
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
        await createMockParticipant(
            adminFirestore,
            fakeCeremoniesData.fakeCeremonyClosedDynamic.uid,
            users[2].uid,
            coordinatorParticipant
        )

        // add a contribution
        const finalContribution = {
            participantId: users[2].uid,
            contributionComputationTime: new Date().valueOf(),
            verificationComputationTime: new Date().valueOf(),
            zkeyIndex: `final`,
            files: {},
            lastUpdate: new Date().valueOf()
        }
        await createMockContribution(
            adminFirestore,
            ceremonyClosed.uid,
            finalizizationCircuit.uid,
            finalContribution,
            contributionId
        )

        if (envType === TestingEnvironment.PRODUCTION) {
            await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
            await createS3Bucket(userFunctions, bucketName)
            await uploadFileToS3(bucketName, verificationKeyStoragePath, verificationKeyLocalPath)
            await uploadFileToS3(bucketName, verifierContractStoragePath, verifierContractLocalPath)
        }
    })
    it("should prevent the coordinator from finalizing the wrong ceremony", async () => {
        // register coordinator
        await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
        await expect(
            finalizeCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
        ).to.be.rejectedWith("Unable to find a document with the given identifier for the provided collection path.")
    })
    it("should prevent standard users from finalizing a ceremony", async () => {
        // register standard user
        await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
        await expect(
            finalizeCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyClosedDynamic.uid)
        ).to.be.rejectedWith("You do not have privileges to perform this operation.")
    })
    it("should return all ceremonies that need finalizing", async () => {
        const closedCeremonies = await getClosedCeremonies(userFirestore)
        // make sure there is at least one ceremony that needs finalizing
        expect(closedCeremonies.length).to.be.gt(0)
    })
    if (envType === TestingEnvironment.PRODUCTION) {
        it("should finalize a ceremony", async () => {
            await sleep(200)
            await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
            const result = await checkAndPrepareCoordinatorForFinalization(userFunctions, ceremonyClosed.uid)
            expect(result).to.be.true
            // call the function
            await expect(finalizeCircuit(userFunctions, ceremonyClosed.uid, finalizizationCircuit.uid, bucketName)).to
                .be.fulfilled

            await expect(finalizeCeremony(userFunctions, ceremonyClosed.uid)).to.be.fulfilled

            const ceremony = await getDocumentById(
                userFirestore,
                commonTerms.collections.ceremonies.name,
                ceremonyClosed.uid
            )
            const ceremonyData = ceremony.data()
            expect(ceremonyData?.state).to.be.eq(CeremonyState.FINALIZED)

            const coordinatorDoc = await getDocumentById(
                userFirestore,
                getParticipantsCollectionPath(ceremonyClosed.uid),
                users[2].uid
            )
            const coordinatorData = coordinatorDoc.data()
            expect(coordinatorData?.status).to.be.eq(ParticipantStatus.FINALIZED)
        })
    }

    afterAll(async () => {
        // clean up
        await cleanUpMockCeremony(adminFirestore, ceremonyClosed.uid, finalizizationCircuit.uid)
        await cleanUpMockCeremony(adminFirestore, ceremonyOpen.uid, finalizizationCircuit.uid)
        await cleanUpMockUsers(adminAuth, adminFirestore, users)

        // Clean up bucket
        if (envType === TestingEnvironment.PRODUCTION) {
            await deleteObjectFromS3(bucketName, verificationKeyStoragePath)
            await deleteObjectFromS3(bucketName, verifierContractStoragePath)
            await deleteBucket(bucketName)
        }

        // Delete admin app.
        await deleteAdminApp()
    })
})
