import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword } from "firebase/auth"
import { getClosedCeremonies } from "../../src"
import { fakeCeremoniesData, fakeCircuitsData, fakeUsersData } from "../data/samples"
import {
    cleanUpMockCeremony,
    cleanUpMockUsers,
    createMockCeremony,
    createMockUser,
    deleteAdminApp,
    generateUserPasswords,
    initializeAdminServices,
    initializeUserServices
} from "../utils"

// Config chai.
chai.use(chaiAsPromised)

describe("Finalization e2e", () => {
    // Initialize admin and user services.
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp, userFirestore } = initializeUserServices()
    const userAuth = getAuth(userApp)

    const users = [fakeUsersData.fakeUser1, fakeUsersData.fakeUser2, fakeUsersData.fakeUser3]
    const passwords = generateUserPasswords(users.length)

    const ceremonyClosed = fakeCeremoniesData.fakeCeremonyClosedDynamic
    const ceremonyOpen = fakeCeremoniesData.fakeCeremonyOpenedFixed
    const circuits = fakeCircuitsData.fakeCircuitSmallNoContributors

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
        await createMockCeremony(adminFirestore, ceremonyClosed, circuits)
        await createMockCeremony(adminFirestore, ceremonyOpen, circuits)
    })

    // if (envType === TestingEnvironment.PRODUCTION) {
    // }

    it("should allow the coordinator to finalize a ceremony", async () => {})
    it("should prevent standard users from finalizing a ceremony", async () => {})
    it("should return all ceremonies that need finalizing", async () => {
        const closedCeremonies = await getClosedCeremonies(userFirestore)
        // make sure there is at least one ceremony that needs finalizing
        expect(closedCeremonies.length).to.be.gt(0)
        // double check that the data is correct
        // register coordinator for final contribution
        await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
        // assert.isFulfilled(await checkAndPrepareCoordinatorForFinalization(userFunctions, ceremonyClosed.uid))
    })
    it("should store the ceremony as finalized once the process is completed", async () => {})

    afterAll(async () => {
        // clean up
        await cleanUpMockUsers(adminAuth, adminFirestore, users)
        await cleanUpMockCeremony(adminFirestore, ceremonyClosed.uid, circuits.uid)
        await cleanUpMockCeremony(adminFirestore, ceremonyOpen.uid, circuits.uid)

        // Delete admin app.
        await deleteAdminApp()
    })
})
