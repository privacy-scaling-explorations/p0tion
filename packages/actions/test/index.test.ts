import { Functions, getFunctions, httpsCallable } from "firebase/functions"
import chai, { assert } from "chai"
import chaiAsPromised from "chai-as-promised"
import { FirebaseDocumentInfo, CeremonyInputData, Circuit } from "types"
import { createS3Bucket, getBucketName, getOpenedCeremonies, multiPartUpload, setupCeremony } from "../src/index"
import {
    initializeAdminServices,
    initializeUserServices,
    signInAnonymouslyWithUser,
    deleteAdminApp,
    sleep
} from "./utils"
import { fakeCeremoniesData, fakeCircuitsData } from "./data/samples"

// Config chai.
chai.use(chaiAsPromised)

describe("Sample e2e", () => {
    // Sample data for running the test.
    let userId: string
    let openedCeremonies: Array<FirebaseDocumentInfo> = []
    let selectedCeremony: FirebaseDocumentInfo

    // Initialize admin and user services.
    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp, userFirestore, userFunctions } = initializeUserServices()

    beforeEach(async () => {
        // Sign-in anonymously with the user.
        const { newUid } = await signInAnonymouslyWithUser(userApp)
        userId = newUid

        // Create the fake data on Firestore.
        await adminFirestore
            .collection(`ceremonies`)
            .doc(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
            .set({
                ...fakeCeremoniesData.fakeCeremonyOpenedFixed.data
            })

        await adminFirestore
            .collection(`ceremonies/${fakeCeremoniesData.fakeCeremonyOpenedFixed.uid}/circuits`)
            .doc(fakeCircuitsData.fakeCircuitSmallNoContributors.uid)
            .set({
                ...fakeCircuitsData.fakeCircuitSmallNoContributors.data
            })

        // TODO: we need to remove this sleep and add listeners.
        // Wait for Cloud Function execution.
        await sleep(3000)

        // Get opened ceremonies.
        openedCeremonies = await getOpenedCeremonies(userFirestore)

        // Select the first ceremony.
        selectedCeremony = openedCeremonies.at(0)!
    })

    it("should reject when user is not authenticated", async () => {
        // Call checkParticipantForCeremony Cloud Function and check the result.
        const checkParticipantForCeremony = httpsCallable(userFunctions, "checkParticipantForCeremony", {})

        assert.isRejected(checkParticipantForCeremony({ ceremonyId: selectedCeremony.id }))
    })

    it('should fail to create a sample ceremony without being a coordinator', async () => {
        const ceremonyData = fakeCeremoniesData.fakeCeremonyOpenedDynamic
        const circuitData = fakeCircuitsData.fakeCircuitSmallNoContributors
        const ceremonyPrefix = ceremonyData.data.title.replace(/[`\s~!@#$%^&*()|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, "-").toLowerCase()
        
        // 1 get the bucket
        const bucket = getBucketName(ceremonyPrefix)

        assert.isRejected(createS3Bucket(userFunctions, bucket))

        // upload zkeys
        assert.isFulfilled(multiPartUpload(userFunctions, bucket, circuitData.data.files.initialZkeyStoragePath, circuitData.data.files.initialZkeyFilename))

        // upload pot
        assert.isFulfilled(multiPartUpload(
            userFunctions,
            bucket,
            circuitData.data.files.potStoragePath,
            circuitData.data.files.potFilename
        ))


        // Upload R1CS.
        assert.isFulfilled(multiPartUpload(
            userFunctions,
            bucket,
            circuitData.data.files.r1csStoragePath,
            circuitData.data.files.r1csFilename
        ))

        const ceremonyInputData: CeremonyInputData = {
            title: ceremonyData.data.title,
            description: ceremonyData.data.description,
            startDate: new Date(ceremonyData.data.startDate),
            endDate: new Date(ceremonyData.data.endDate),
            timeoutMechanismType: ceremonyData.data.timeoutType,
            penalty: ceremonyData.data.penalty
        }

        const circuitInputData: Circuit = {
            description: circuitData.data.description,
            compiler: circuitData.data.compiler,
            template: {
                paramsConfiguration: ['2'],
                commitHash: circuitData.data.template.commitHash,
                source: circuitData.data.template.source
            },
            metadata: circuitData.data.metadata
        }

        assert.isFulfilled(setupCeremony(
            userFunctions,
            ceremonyInputData,
            ceremonyPrefix,
            [circuitInputData]
        ))
    })

    afterAll(async () => {
        // Clean ceremony and user from DB.
        await adminFirestore.collection("users").doc(userId).delete()

        await adminFirestore
            .collection(`ceremonies/${fakeCeremoniesData.fakeCeremonyOpenedFixed.uid}/circuits`)
            .doc(fakeCircuitsData.fakeCircuitSmallNoContributors.uid)
            .delete()

        await adminFirestore.collection(`ceremonies`).doc(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid).delete()

        // Remove Auth user.
        await adminAuth.deleteUser(userId)

        // Delete admin app.
        await deleteAdminApp()
    })
})
