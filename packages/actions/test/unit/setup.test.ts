import chai, { assert, expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth"
import fs from "fs"
import {
    setCustomClaims,
    createNewFirebaseUserWithEmailAndPw,
    deleteAdminApp,
    generatePseudoRandomStringOfNumbers,
    initializeAdminServices,
    initializeUserServices,
    sleep
} from "../utils"
import { setupCeremony, getCurrentFirebaseAuthUser } from "../../src"
import {
    extractR1CSInfoValueForGivenKey,
    computeSmallestPowersOfTauForCircuit,
    extractCircuitMetadata
} from "../../src/helpers/utils"
import { fakeCeremoniesData, fakeCircuitsData, fakeUsersData } from "../data/samples"

chai.use(chaiAsPromised)

describe("Setup", () => {
    const user = fakeUsersData.fakeUser1
    const coordinatorEmail = "coordinator@coordinator.com"
    // storing the uid so we can delete the user after the test
    let coordinatorUid: string

    const { adminFirestore, adminAuth } = initializeAdminServices()

    const { userApp, userFunctions } = initializeUserServices()
    const userAuth = getAuth(userApp)
    const userPassword = generatePseudoRandomStringOfNumbers(24)
    const coordinatorPwd = generatePseudoRandomStringOfNumbers(24)

    const ceremonyPostfix = "-mpc-dev"

    const filePath = "/tmp/metadata.log"
    const circuitMetadata =
        "Curve: bn-128\n# of Wires: 6\n# of Constraints: 1\n# of Private Inputs: 3\n# of Public Inputs: 1\n# of Labels: 8\n# of Outputs: 1\n"

    beforeAll(async () => {
        // create a new user without contributor privileges
        await createNewFirebaseUserWithEmailAndPw(userApp, user.data.email, userPassword)

        await sleep(5000)

        // Retrieve the current auth user in Firebase.
        const currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
        user.uid = currentAuthenticatedUser.uid

        // create account for coordinator
        await createNewFirebaseUserWithEmailAndPw(userApp, coordinatorEmail, coordinatorPwd)

        await sleep(5000)

        const currentAuthenticatedCoordinator = getCurrentFirebaseAuthUser(userApp)
        coordinatorUid = currentAuthenticatedCoordinator.uid
        await setCustomClaims(adminAuth, coordinatorUid, { coordinator: true })

        // write metadata file
        fs.writeFileSync(filePath, circuitMetadata)
    })

    describe("setupCeremony", () => {
        it("should fail when called by an authenticated user without coordinator privileges", async () => {
            // Sign in as user.
            await signInWithEmailAndPassword(userAuth, user.data.email, userPassword)
            assert.isRejected(
                setupCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyNotCreated, ceremonyPostfix, [])
            )
        })
        it("should succeed when called by an authenticated user with coordinator privileges", async () => {
            // Sign in as coordinator.
            await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
            assert.isFulfilled(
                setupCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyNotCreated, ceremonyPostfix, [
                    fakeCircuitsData.fakeCircuitSmallNoContributors as any
                ])
            )
        })
        it("should fail when called without being authenticated", async () => {
            // sign out
            await signOut(userAuth)
            assert.isRejected(
                setupCeremony(userFunctions, fakeCeremoniesData.fakeCeremonyNotCreated, ceremonyPostfix, [
                    fakeCircuitsData.fakeCircuitSmallNoContributors as any
                ])
            )
        })
    })
    describe("extractCircuitMetadata", () => {
        it("should correctlty extract the circuit metadata", () => {
            const { curve, wires, constraints, privateInputs, publicInputs, labels, outputs, pot } =
                extractCircuitMetadata(filePath)
            expect(curve.trimEnd()).to.be.eq("bn-128")
            expect(wires).to.be.eq(6)
            expect(constraints).to.be.eq(1)
            expect(privateInputs).to.be.eq(3)
            expect(publicInputs).to.be.eq(1)
            expect(labels).to.be.eq(8)
            expect(outputs).to.be.eq(1)
            expect(pot).to.be.eq(computeSmallestPowersOfTauForCircuit(constraints, outputs))
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
        await adminFirestore.collection("users").doc(user.uid).delete()
        await adminFirestore.collection("users").doc(coordinatorUid).delete()
        // Remove Auth user.
        await adminAuth.deleteUser(user.uid)
        await adminAuth.deleteUser(coordinatorUid)
        await deleteAdminApp()

        // delete metadata file
        fs.unlinkSync(filePath)
    })
})
