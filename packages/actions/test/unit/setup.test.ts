import chai, { assert, expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth"
import fs from "fs"
import {
    deleteAdminApp,
    initializeAdminServices,
    initializeUserServices,
    createMockUser,
    generateUserPasswords,
    cleanUpMockUsers,
    getStorageConfiguration,
    cleanUpMockCeremony
} from "../utils"
import { commonTerms, getCeremonyCircuits, getDocumentById, setupCeremony } from "../../src"
import { extractR1CSInfoValueForGivenKey, computeSmallestPowersOfTauForCircuit } from "../../src/helpers/utils"
import { fakeCeremoniesData, fakeCircuitsData, fakeUsersData } from "../data/samples"

chai.use(chaiAsPromised)

describe("Setup", () => {
    // test users (2nd is coordinator)
    const users = [fakeUsersData.fakeUser1, fakeUsersData.fakeUser2]
    const passwords = generateUserPasswords(2)

    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp, userFirestore, userFunctions } = initializeUserServices()
    const userAuth = getAuth(userApp)

    const { ceremonyBucketPostfix } = getStorageConfiguration()

    let ceremonyId: string
    let circuitId: string

    // test metadata
    const filePath = `/tmp/${commonTerms.foldersAndPathsTerms.metadata}.log`
    const circuitMetadata =
        "Curve: bn-128\n# of Wires: 6\n# of Constraints: 1\n# of Private Inputs: 3\n# of Public Inputs: 1\n# of Labels: 8\n# of Outputs: 1\n"

    beforeAll(async () => {
        // create two users and set the second as coordinator
        for (let i = 0; i < 2; i++) {
            const uid = await createMockUser(
                userApp,
                users[i].data.email,
                passwords[i],
                i === passwords.length - 1,
                adminAuth
            )
            users[i].uid = uid
        }

        // write metadata file
        fs.writeFileSync(filePath, circuitMetadata)
    })

    describe("setupCeremony", () => {
        it("should fail when called by an authenticated user without coordinator privileges", async () => {
            // Sign in as user.
            await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
            assert.isRejected(
                setupCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyNotCreated, ceremonyBucketPostfix, [
                    fakeCircuitsData.fakeCircuitSmallNoContributors as any
                ])
            )
        })
        it("should succeed when called by an authenticated user with coordinator privileges", async () => {
            // Sign in as coordinator.
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            const circuit = fakeCircuitsData.fakeCircuitSmallNoContributors
            const ceremony = fakeCeremoniesData.fakeCeremonyNotCreated
            ceremonyId = await setupCeremony(userFunctions, ceremony, ceremonyBucketPostfix, [circuit as any])
            expect(ceremonyId).to.be.a.string
            const ceremonyDoc = await getDocumentById(
                userFirestore,
                commonTerms.collections.ceremonies.name,
                ceremonyId
            )
            const ceremonyData = ceremonyDoc.data()
            // confirm ceremony
            expect(ceremonyData?.state).to.be.eq("SCHEDULED")
            expect(ceremonyData?.timeoutType).to.be.eq(ceremony.timeoutMechanismType)
            expect(ceremonyData?.endDate).to.be.eq(ceremony.endDate)
            expect(ceremonyData?.penalty).to.be.eq(ceremony.penalty)
            expect(ceremonyData?.description).to.be.eq(ceremony.description)
            expect(ceremonyData?.coordinatorId).to.be.eq(users[1].uid)
            expect(ceremonyData?.lastUpdated).to.be.lt(Date.now().valueOf())

            const circuits = await getCeremonyCircuits(userFirestore, ceremonyId)
            expect(circuits.length).to.be.eq(1)
            const circuitCreated = circuits[0]
            circuitId = circuitCreated.id
            expect(circuitCreated.data.lastUpdated).to.lt(Date.now().valueOf())
        })
        it("should fail when called without being authenticated", async () => {
            // sign out
            await signOut(userAuth)
            assert.isRejected(
                setupCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyNotCreated, ceremonyBucketPostfix, [
                    fakeCircuitsData.fakeCircuitSmallNoContributors as any
                ])
            )
        })
    })

    describe("getCircuitMetadataFromR1csFile", () => {
        it("should correctly parse the metadata from the r1cs file", () => {
            // Extract info from file.
            expect(extractR1CSInfoValueForGivenKey(filePath, /Curve: .+\n/s).trimEnd()).to.be.eq("bn-128")
            expect(Number(extractR1CSInfoValueForGivenKey(filePath, /# of Wires: .+\n/s))).to.be.eq(6)
            expect(Number(extractR1CSInfoValueForGivenKey(filePath, /# of Constraints: .+\n/s))).to.be.eq(1)
            expect(Number(extractR1CSInfoValueForGivenKey(filePath, /# of Private Inputs: .+\n/s))).to.be.eq(3)
            expect(Number(extractR1CSInfoValueForGivenKey(filePath, /# of Public Inputs: .+\n/s))).to.be.eq(1)
            expect(Number(extractR1CSInfoValueForGivenKey(filePath, /# of Labels: .+\n/s))).to.be.eq(8)
            expect(Number(extractR1CSInfoValueForGivenKey(filePath, /# of Outputs: .+\n/s))).to.be.eq(1)
        })
        it("should throw when looking for non-existent metadata", () => {
            expect(() => extractR1CSInfoValueForGivenKey(filePath, /# of W1res: .+\n/)).to.throw(
                "Unable to retrieve circuit metadata. Possible causes may involve an error while using the logger. Please, check whether the corresponding `.log` file is present in your local `output/setup/metadata` folder. In any case, we kindly ask you to terminate the current session and repeat the process."
            )
        })
    })

    describe("estimatePoT", () => {
        it("should correctly estimate PoT given the number of constraints", () => {
            expect(computeSmallestPowersOfTauForCircuit(10e6, 2)).to.be.eq(24)
        })
    })

    afterAll(async () => {
        // Clean ceremony and user from DB.
        await cleanUpMockUsers(adminAuth, adminFirestore, users)
        // Remove ceremony.
        await cleanUpMockCeremony(adminFirestore, ceremonyId, circuitId)
        // Delete app.
        await deleteAdminApp()

        // delete metadata file
        fs.unlinkSync(filePath)
    })
})
