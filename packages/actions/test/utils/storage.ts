import {
    CeremonyDocumentReferenceAndData,
    CircuitDocumentReferenceAndData,
    ParticipantDocumentReferenceAndData
} from "../../src/types"
import { ParticipantContributionStep, ParticipantStatus, TimeoutType } from "../../src/types/enums"
import {
    commonTerms,
    getCircuitsCollectionPath,
    getContributionsCollectionPath,
    getParticipantsCollectionPath,
    getTimeoutsCollectionPath
} from "../../src"
import { generateFakeParticipant } from "../data/generators"

/**
 * Creates mock data on Firestore (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param ceremonyData <CeremonyDocumentReferenceAndData> the ceremony data
 * @param circuitData <CircuitDocumentReferenceAndData> the circuit data
 */
export const createMockCeremony = async (
    adminFirestore: FirebaseFirestore.Firestore,
    ceremonyData: CeremonyDocumentReferenceAndData,
    circuitData: CircuitDocumentReferenceAndData
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
    ceremonyId: string,
    circuitId: string
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
    ceremonyId: string,
    circuitId: string,
    contribution: any
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
    ceremonyId: string,
    circuitId: string
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
    ceremonyId: string,
    participantId: string,
    participantData: ParticipantDocumentReferenceAndData
) => {
    await adminFirestore
        .collection(getParticipantsCollectionPath(ceremonyId))
        .doc(participantId)
        .set({
            ...participantData.data
        })
}

/**
 * Store a participant on Firestore with contribution Done (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param ceremonyId <string> the ceremony id
 * @param participantUID <string> the participant uid
 */
export const storeMockDoneParticipant = async (
    adminFirestore: FirebaseFirestore.Firestore,
    ceremonyId: string,
    participantUID: string
) => {
    const participantDone = generateFakeParticipant({
        uid: participantUID,
        data: {
            userId: participantUID,
            contributionProgress: 1,
            contributionStep: ParticipantContributionStep.COMPLETED,
            status: ParticipantStatus.DONE,
            contributions: [
                {
                    computationTime: 1439,
                    doc: "000001",
                    hash: "Contribution Hash: 0xhash"
                }
            ],
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
    await storeMockParticipant(adminFirestore, ceremonyId, participantUID, participantDone)
}

/**
 * Clean up the mock participant at step 1 from Firestore (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param ceremonyId <string> the ceremony id
 */
export const cleanUpMockParticipant = async (
    adminFirestore: FirebaseFirestore.Firestore,
    ceremonyId: string,
    participantId: string
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
    ceremonyId: string
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
    ceremonyId: string
) => {
    const timeoutUID = "00000001"
    await adminFirestore.collection(getTimeoutsCollectionPath(ceremonyId, contributorId)).doc(timeoutUID).delete()
}
