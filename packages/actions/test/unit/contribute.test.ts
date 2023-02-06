import chai, { assert, expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { fakeCeremoniesData, fakeUsersData } from "../data/samples"
import { convertToGB, getCeremonyCircuits, getZkeysSpaceRequirementsForContributionInGB } from "../../src"
import {
    cleanUpMockCeremony,
    createMockCeremony,
    deleteAdminApp,
    initializeAdminServices,
    initializeUserServices
} from "../utils"

chai.use(chaiAsPromised)

/**
 * Unit tests for the contribute action
 */
describe("Contribute", () => {
    // Init admin services.
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userFirestore } = initializeUserServices()
    const firstContributor = fakeUsersData.fakeUser1
    const secondContributor = fakeUsersData.fakeUser2

    // setup - create few users
    beforeAll(async () => {
        await createMockCeremony(adminFirestore)
    })

    describe("convertToGB", () => {
        it("should convert bytes to GB correctly", () => {
            expect(convertToGB(1000000000, true)).to.equal(0.9313225746154785)
            expect(convertToGB(1000000000, false)).to.equal(953.67431640625)
        })
    })

    describe("getZkeysSpaceRequirementsForContributionInGB", () => {
        it("should calculate the space requirements correctly", () => {
            expect(getZkeysSpaceRequirementsForContributionInGB(1000000000)).to.equal(1.862645149230957)
            expect(getZkeysSpaceRequirementsForContributionInGB(1073741824)).to.equal(2)
        })
    })

    describe("getCeremonyCircuits", () => {
        it("should fail when not authenticated", async () => {
            assert.isRejected(getCeremonyCircuits(userFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid))
        })
        it.skip("should return the circuits for the specified ceremony", async () => {
            // auth
            const circuits = await getCeremonyCircuits(userFirestore, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            expect(circuits.length).to.be.gt(0)
        })
        it.skip("should not return any results for a non-existing ceremony", async () => {
            // auth
            const circuits = await getCeremonyCircuits(userFirestore, "non-existing")
            expect(circuits.length).to.equal(0)
        })
        it("should revert when given the wrong firebase db arguement", async () => {
            // auth
            assert.isRejected(getCeremonyCircuits({} as any, fakeCeremoniesData.fakeCeremonyOpenedFixed.uid))
        })
    })

    describe("getNextCircuitForContribution", () => {})
    describe("permanentlyStoreCurrentContributionTimeAndHash", () => {})
    describe("makeProgressToNextContribution", () => {})

    afterAll(async () => {
        // Clean user from DB.
        await adminFirestore.collection("users").doc(firstContributor.uid).delete()
        await adminFirestore.collection("users").doc(secondContributor.uid).delete()

        // Remove Auth user.
        await adminAuth.deleteUser(firstContributor.uid)
        await adminAuth.deleteUser(secondContributor.uid)

        // Clean up ceremonies data
        await cleanUpMockCeremony(adminFirestore)

        // Delete admin app.
        await deleteAdminApp()
    })
})
