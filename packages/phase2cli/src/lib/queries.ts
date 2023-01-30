import { Firestore, where } from "firebase/firestore"
import { queryCollection, fromQueryToFirebaseDocumentInfo, getAllCollectionDocs, commonTerms } from "@zkmpc/actions"
import { FirebaseDocumentInfo } from "../../types/index"

/**
 * Retrieve all ceremonies documents from Firestore database.
 * @param firestore <Firestore> - the instance of the Firestore database.
 * @returns Promise<Array<FirebaseDocumentInfo>>
 */
export const getAllCeremoniesDocuments = async (firestore: Firestore): Promise<Array<FirebaseDocumentInfo>> =>
    fromQueryToFirebaseDocumentInfo(
        await getAllCollectionDocs(firestore, commonTerms.collections.ceremonies.name)
    ).sort((a: FirebaseDocumentInfo, b: FirebaseDocumentInfo) => a.data.sequencePosition - b.data.sequencePosition)

/**
 * Query for circuits with a contribution from given participant.
 * @param ceremonyId <string> - the identifier of the ceremony.
 * @param circuits <Array<FirebaseDocumentInfo>> - the circuits of the ceremony
 * @param participantId <string> - the identifier of the participant.
 * @returns <Promise<Array<FirebaseDocumentInfo>>>
 */
export const getCircuitsWithParticipantContribution = async (
    ceremonyId: string,
    circuits: Array<FirebaseDocumentInfo>,
    participantId: string
): Promise<Array<string>> => {
    const circuitsWithContributionIds: Array<string> = [] // nb. store circuit identifier.

    for (const circuit of circuits) {
        const participantContributionQuerySnap = await queryCollection(
            `${commonTerms.collections.ceremonies.name}/${ceremonyId}/${commonTerms.collections.circuits.name}/${circuit.id}/${commonTerms.collections.contributions.name}`,
            [where(commonTerms.collections.contributions.fields.participantId, "==", participantId)]
        )

        if (participantContributionQuerySnap.size === 1) circuitsWithContributionIds.push(circuit.id)
    }

    return circuitsWithContributionIds
}
