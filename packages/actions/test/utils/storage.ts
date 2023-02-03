import { CeremonyDocumentReferenceAndData, CircuitDocumentReferenceAndData } from "src/types"
import { fakeCeremoniesData, fakeCircuitsData } from "../data/samples"

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
        .collection(`ceremonies`)
        .doc(ceremonyData.uid)
        .set({
            ...ceremonyData.data
        })

    await adminFirestore
        .collection(`ceremonies/${ceremonyData.uid}/circuits`)
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
    await adminFirestore.collection(`ceremonies/${ceremonyId}/circuits`).doc(circuitId).delete()

    await adminFirestore.collection(`ceremonies`).doc(ceremonyId).delete()
}
