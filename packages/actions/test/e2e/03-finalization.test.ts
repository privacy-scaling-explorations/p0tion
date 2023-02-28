import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword } from "firebase/auth"
import { finalizeCeremony, getClosedCeremonies } from "../../src"
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
    const { userApp, userFirestore, userFunctions } = initializeUserServices()
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

    afterAll(async () => {
        // clean up
        await cleanUpMockUsers(adminAuth, adminFirestore, users)
        await cleanUpMockCeremony(adminFirestore, ceremonyClosed.uid, circuits.uid)
        await cleanUpMockCeremony(adminFirestore, ceremonyOpen.uid, circuits.uid)

        // Delete admin app.
        await deleteAdminApp()
    })
})
