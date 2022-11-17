import { Firestore, where } from "firebase/firestore"
import {
  CeremonyCollectionField,
  CeremonyState,
  Collections,
  FirebaseDocumentInfo
} from "packages/actions/types/index.js"
import { queryCollection, fromQueryToFirebaseDocumentInfo, getAllCollectionDocs } from "../../helpers/query.js"

/**
 * Query for opened ceremonies documents and return their data (if any).
 * @param firestoreDatabase <Firestore> - the Firebase Firestore associated to the current application.
 * @returns <Promise<Array<FirebaseDocumentInfo>>>
 */
export const getOpenedCeremonies = async (firestoreDatabase: Firestore): Promise<Array<FirebaseDocumentInfo>> => {
  const runningStateCeremoniesQuerySnap = await queryCollection(firestoreDatabase, Collections.CEREMONIES, [
    where(CeremonyCollectionField.STATE, "==", CeremonyState.OPENED),
    where(CeremonyCollectionField.END_DATE, ">=", Date.now())
  ])

  return runningStateCeremoniesQuerySnap.empty && runningStateCeremoniesQuerySnap.size === 0
    ? []
    : fromQueryToFirebaseDocumentInfo(runningStateCeremoniesQuerySnap.docs)
}

/**
 * Retrieve all circuits associated to a ceremony.
 * @param firestoreDatabase <Firestore> - the Firebase Firestore associated to the current application.
 * @param ceremonyId <string> - the identifier of the ceremony.
 * @returns Promise<Array<FirebaseDocumentInfo>>
 */
export const getCeremonyCircuits = async (
  firestoreDatabase: Firestore,
  ceremonyId: string
): Promise<Array<FirebaseDocumentInfo>> =>
  fromQueryToFirebaseDocumentInfo(
    await getAllCollectionDocs(firestoreDatabase, `${Collections.CEREMONIES}/${ceremonyId}/${Collections.CIRCUITS}`)
  ).sort((a: FirebaseDocumentInfo, b: FirebaseDocumentInfo) => a.data.sequencePosition - b.data.sequencePosition)
