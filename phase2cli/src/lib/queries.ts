import { where } from "firebase/firestore"
import { FirebaseDocumentInfo, CeremonyState } from "../../types/index.js"
import { queryCollection, getAllCollectionDocs } from "./firebase.js"
import { theme } from "./constants.js"
import { fromQueryToFirebaseDocumentInfo } from "./utils.js"

/**
 * Query for opened ceremonies documents and return their data (if any).
 * @returns <Promise<Array<FirebaseDocumentInfo>>>
 */
export const getOpenedCeremonies = async (): Promise<Array<FirebaseDocumentInfo>> => {
  const runningStateCeremoniesQuerySnap = await queryCollection("ceremonies", [
    where("state", "==", CeremonyState.OPENED)
  ])

  if (runningStateCeremoniesQuerySnap.empty && runningStateCeremoniesQuerySnap.size === 0) {
    console.error(theme.red("We are sorry but there are no ceremonies running at this moment. Please try again later!"))

    process.exit(0)
  }

  return fromQueryToFirebaseDocumentInfo(runningStateCeremoniesQuerySnap.docs)
}

/**
 * Retrieve all circuits associated to a ceremony.
 * @param ceremonyId <string> - the identifier of the ceremony.
 * @returns Promise<Array<FirebaseDocumentInfo>>
 */
export const getCeremonyCircuits = async (ceremonyId: string): Promise<Array<FirebaseDocumentInfo>> =>
  fromQueryToFirebaseDocumentInfo(await getAllCollectionDocs(`ceremonies/${ceremonyId}/circuits`)).sort(
    (a: FirebaseDocumentInfo, b: FirebaseDocumentInfo) => a.data.sequencePosition - b.data.sequencePosition
  )

/**
 * Query for contribution from given participant for a given circuit (if any).
 * @param ceremonyId <string> - the identifier of the ceremony.
 * @param circuitId <string> - the identifier of the circuit.
 * @param participantId <string> - the identifier of the participant.
 * @returns <Promise<Array<FirebaseDocumentInfo>>>
 */
export const getCurrentContributorContribution = async (
  ceremonyId: string,
  circuitId: string,
  participantId: string
): Promise<Array<FirebaseDocumentInfo>> => {
  const participantContributionQuerySnap = await queryCollection(
    `ceremonies/${ceremonyId}/circuits/${circuitId}/contributions`,
    [where("participantId", "==", participantId)]
  )

  return fromQueryToFirebaseDocumentInfo(participantContributionQuerySnap.docs)
}
