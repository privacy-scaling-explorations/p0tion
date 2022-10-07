import { where } from "firebase/firestore"
import { FirebaseDocumentInfo, CeremonyState } from "../../types/index.js"
import { queryCollection, getAllCollectionDocs } from "./firebase.js"
import {
  ceremoniesCollectionFields,
  collections,
  contributionsCollectionFields,
  timeoutsCollectionFields
} from "./constants.js"
import { fromQueryToFirebaseDocumentInfo, getServerTimestampInMillis } from "./utils.js"
import { FIREBASE_ERRORS, showError } from "./errors.js"

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
      showError(FIREBASE_ERRORS.FIREBASE_CEREMONY_NOT_OPENED, true)
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
      showError(FIREBASE_ERRORS.FIREBASE_CEREMONY_NOT_CLOSED, true)
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
 * Retrieve all ceremonies.
 * @returns Promise<Array<FirebaseDocumentInfo>>
 */
export const getAllCeremonies = async (): Promise<Array<FirebaseDocumentInfo>> =>
  fromQueryToFirebaseDocumentInfo(await getAllCollectionDocs(`${collections.ceremonies}`)).sort(
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
    `${collections.ceremonies}/${ceremonyId}/${collections.circuits}/${circuitId}/${collections.contributions}`,
    [where(contributionsCollectionFields.participantId, "==", participantId)]
  )

  return fromQueryToFirebaseDocumentInfo(participantContributionQuerySnap.docs)
}

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
      `${collections.ceremonies}/${ceremonyId}/${collections.circuits}/${circuit.id}/${collections.contributions}`,
      [where(contributionsCollectionFields.participantId, "==", participantId)]
    )

    if (participantContributionQuerySnap.size === 1) circuitsWithContributionIds.push(circuit.id)
  }

  return circuitsWithContributionIds
}

/**
 * Query for the active timeout from given participant for a given ceremony (if any).
 * @param ceremonyId <string> - the identifier of the ceremony.
 * @param participantId <string> - the identifier of the participant.
 * @returns Promise<Array<FirebaseDocumentInfo>>
 */
export const getCurrentActiveParticipantTimeout = async (
  ceremonyId: string,
  participantId: string
): Promise<Array<FirebaseDocumentInfo>> => {
  const participantTimeoutQuerySnap = await queryCollection(
    `${collections.ceremonies}/${ceremonyId}/${collections.participants}/${participantId}/${collections.timeouts}`,
    [where(timeoutsCollectionFields.endDate, ">=", getServerTimestampInMillis())]
  )

  return fromQueryToFirebaseDocumentInfo(participantTimeoutQuerySnap.docs)
}
