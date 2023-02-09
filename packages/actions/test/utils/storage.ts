import { fakeCeremoniesData, fakeCircuitsData, fakeContributions, fakeParticipantsData } from "../data/samples"
import {
    CeremonyDocumentReferenceAndData,
    CircuitDocumentReferenceAndData,
    ParticipantDocumentReferenceAndData
} from "../../src/types"
import { TimeoutType } from "../../src/types/enums"
import {
    commonTerms,
    getCircuitsCollectionPath,
    getContributionsCollectionPath,
    getParticipantsCollectionPath,
    getTimeoutsCollectionPath
} from "../../src"

/**
 * Creates mock data on Firestore (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param ceremonyData <CeremonyDocumentReferenceAndData> the ceremony data
 * @param circuitData <CircuitDocumentReferenceAndData> the circuit data
 */
export const createMockCeremony = async (
    adminFirestore: FirebaseFirestore.Firestore,
    ceremonyData: CeremonyDocumentReferenceAndData = fakeCeremoniesData.fakeCeremonyOpenedFixed,
    circuitData: CircuitDocumentReferenceAndData = fakeCircuitsData.fakeCircuitSmallNoContributors
) => {
    // Create the mock data on Firestore.
    await adminFirestore
        .collection(commonTerms.collections.ceremonies.name)
        .doc(ceremonyData.uid)
        .set({
            ...ceremonyData.data
        })

    await adminFirestore
        .collection(getCircuitsCollectionPath(ceremonyData.uid))
        .doc(circuitData.uid)
        .set({
            ...circuitData.data
        })
}

/**
 * Cleans up mock data on Firestore (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param ceremonyId <string> the ceremony id
 * @param circuitId <string> the circuit id
 */
export const cleanUpMockCeremony = async (
    adminFirestore: FirebaseFirestore.Firestore,
    ceremonyId: string = fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
    circuitId: string = fakeCircuitsData.fakeCircuitSmallNoContributors.uid
) => {
    await adminFirestore.collection(getCircuitsCollectionPath(ceremonyId)).doc(circuitId).delete()
    await adminFirestore.collection(commonTerms.collections.ceremonies.name).doc(ceremonyId).delete()
}

/**
 * Creates a mock contribution on Firestore (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param contributorId <string> the contributor id
 * @param ceremonyId <string> the ceremony id
 * @param circuitId <string> the circuit id
 */
export const createMockContribution = async (
    adminFirestore: FirebaseFirestore.Firestore,
    ceremonyId: string = fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
    circuitId: string = fakeCircuitsData.fakeCircuitSmallNoContributors.uid,
    contribution: any = fakeContributions.fakeContributionDone
) => {
    const contributionId = "0000001"
    await adminFirestore
        .collection(getContributionsCollectionPath(ceremonyId, circuitId))
        .doc(contributionId)
        .set({
            ...contribution.data
        })
}

/**
 * Delete a mock contribution (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param contributorId <string> the contributor id
 * @param ceremonyId <string> the ceremony id
 * @param circuitId <string> the circuit id
 */
export const cleanUpMockContribution = async (
    adminFirestore: FirebaseFirestore.Firestore,
    ceremonyId: string = fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
    circuitId: string = fakeCircuitsData.fakeCircuitSmallNoContributors.uid
) => {
    const contributionId = "0000001"
    await adminFirestore.collection(getContributionsCollectionPath(ceremonyId, circuitId)).doc(contributionId).delete()
}

/**
 * Store a participant on Firestore (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param ceremonyId <string> the ceremony id
 */
export const storeMockParticipant = async (
    adminFirestore: FirebaseFirestore.Firestore,
    ceremonyId: string = fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
    participantData: ParticipantDocumentReferenceAndData = fakeParticipantsData.fakeParticipantCurrentContributorStepOne
) => {
    console.log(participantData.data)
    await adminFirestore
        .collection(getParticipantsCollectionPath(ceremonyId))
        .doc(participantData.uid)
        .set({
            ...participantData.data
        })
}

/**
 * Clean up the mock participant at step 1 from Firestore (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param ceremonyId <string> the ceremony id
 */
export const cleanUpMockParticipant = async (
    adminFirestore: FirebaseFirestore.Firestore,
    ceremonyId: string = fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
    participantId: string = fakeParticipantsData.fakeParticipantCurrentContributorStepOne.uid
) => {
    await adminFirestore.collection(getParticipantsCollectionPath(ceremonyId)).doc(participantId).delete()
}

/**
 * Creates a mock timed out contribution on Firestore (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param contributorId <string> the contributor id
 * @param ceremonyId <string> the ceremony id
 * @param circuitId <string> the circuit id
 */
export const createMockTimedOutContribution = async (
    adminFirestore: FirebaseFirestore.Firestore,
    contributorId: string,
    ceremonyId: string = fakeCeremoniesData.fakeCeremonyOpenedFixed.uid
) => {
    const timeoutUID = "00000001"
    await adminFirestore.collection(getParticipantsCollectionPath(ceremonyId)).doc(contributorId).set({
        contributionProgress: 1,
        contributionStartedAt: new Date().valueOf(),
        contributionStep: "DOWNLOADING",
        lastUpdated: new Date().valueOf(),
        status: "TIMEDOUT"
    })

    await adminFirestore
        .collection(getTimeoutsCollectionPath(ceremonyId, contributorId))
        .doc(timeoutUID)
        .set({
            endDate: new Date().valueOf() * 2,
            startDate: new Date().valueOf(),
            type: TimeoutType.BLOCKING_CONTRIBUTION
        })
}

/**
 * Clean up a mock timeout (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param contributorId <string> the contributor id
 * @param ceremonyId <string> the ceremony id
 */
export const cleanUpMockTimeout = async (
    adminFirestore: FirebaseFirestore.Firestore,
    contributorId: string,
    ceremonyId: string = fakeCeremoniesData.fakeCeremonyOpenedFixed.uid
) => {
    const timeoutUID = "00000001"
    await adminFirestore.collection(getTimeoutsCollectionPath(ceremonyId, contributorId)).doc(timeoutUID).delete()
}
