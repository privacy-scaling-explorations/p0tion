import { where } from "firebase/firestore"
import { FirebaseDocumentInfo, CeremonyState } from "../../types/index.js"
import { queryCollection, getAllCollectionDocs } from "./firebase.js"
import { ceremoniesCollectionFields, collections, contributionsCollectionFields } from "./constants.js"
import { fromQueryToFirebaseDocumentInfo } from "./utils.js"
import { showError } from "./errors.js"

/**
 * Query for opened ceremonies documents and return their data (if any).
 * @returns <Promise<Array<FirebaseDocumentInfo>>>
 */
export const getOpenedCeremonies = async (): Promise<Array<FirebaseDocumentInfo>> => {
  let runningStateCeremoniesQuerySnap: any

  try {
    runningStateCeremoniesQuerySnap = await queryCollection(collections.ceremonies, [
      where(ceremoniesCollectionFields.state, "==", CeremonyState.OPENED),
      where(ceremoniesCollectionFields.endDate, ">=", Date.now())
    ])

    if (runningStateCeremoniesQuerySnap.empty && runningStateCeremoniesQuerySnap.size === 0)
      throw new Error(`There are no ceremonies taking place right now`)
  } catch (err: any) {
    showError(err.toString(), true)
  }

  return fromQueryToFirebaseDocumentInfo(runningStateCeremoniesQuerySnap.docs)
}

/**
 * Query for closed ceremonies documents and return their data (if any).
 * @returns <Promise<Array<FirebaseDocumentInfo>>>
 */
export const getClosedCeremonies = async (): Promise<Array<FirebaseDocumentInfo>> => {
  let closedStateCeremoniesQuerySnap: any

  try {
    closedStateCeremoniesQuerySnap = await queryCollection(collections.ceremonies, [
      where(ceremoniesCollectionFields.state, "==", CeremonyState.CLOSED),
      where(ceremoniesCollectionFields.endDate, "<=", Date.now())
    ])

    if (closedStateCeremoniesQuerySnap.empty && closedStateCeremoniesQuerySnap.size === 0)
      throw new Error(`There are no closed ceremonies right now`)
  } catch (err: any) {
    showError(err.toString(), true)
  }

  return fromQueryToFirebaseDocumentInfo(closedStateCeremoniesQuerySnap.docs)
}

/**
 * Retrieve all circuits associated to a ceremony.
 * @param ceremonyId <string> - the identifier of the ceremony.
 * @returns Promise<Array<FirebaseDocumentInfo>>
 */
export const getCeremonyCircuits = async (ceremonyId: string): Promise<Array<FirebaseDocumentInfo>> =>
  fromQueryToFirebaseDocumentInfo(
    await getAllCollectionDocs(`${collections.ceremonies}/${ceremonyId}/${collections.circuits}`)
  ).sort((a: FirebaseDocumentInfo, b: FirebaseDocumentInfo) => a.data.sequencePosition - b.data.sequencePosition)

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
    `${collections.ceremonies}/${ceremonyId}/${collections.circuits}/${circuitId}/${collections.contributions}`,
    [where(contributionsCollectionFields.participantId, "==", participantId)]
  )

  return fromQueryToFirebaseDocumentInfo(participantContributionQuerySnap.docs)
}
