import {
  collection as collectionRef,
  DocumentData,
  Firestore,
  getDocs,
  query,
  QueryConstraint,
  QueryDocumentSnapshot,
  QuerySnapshot
} from "firebase/firestore"
import { FirebaseDocumentInfo } from "packages/actions/types/index.js"

/**
 * Helper for query a collection based on certain constraints.
 * @param firestoreDatabase <Firestore> - the Firebase Firestore associated to the current application.
 * @param collection <string> - the name of the collection.
 * @param queryConstraints <Array<QueryConstraint>> - a sequence of where conditions.
 * @returns <Promise<QuerySnapshot<DocumentData>>> - return the matching documents (if any).
 */
export const queryCollection = async (
  firestoreDatabase: Firestore,
  collection: string,
  queryConstraints: Array<QueryConstraint>
): Promise<QuerySnapshot<DocumentData>> => {
  // Make a query.
  const q = query(collectionRef(firestoreDatabase, collection), ...queryConstraints)

  // Get docs.
  return getDocs(q)
}

/**
 * Helper for obtaining uid and data for query document snapshots.
 * @param queryDocSnap <Array<QueryDocumentSnapshot>> - the array of query document snapshot to be converted.
 * @returns Array<FirebaseDocumentInfo>
 */
export const fromQueryToFirebaseDocumentInfo = (
  queryDocSnap: Array<QueryDocumentSnapshot>
): Array<FirebaseDocumentInfo> =>
  queryDocSnap.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
    id: doc.id,
    ref: doc.ref,
    data: doc.data()
  }))

/**
 * Fetch for all documents in a collection.
 * @param firestoreDatabase <Firestore> - the Firebase Firestore associated to the current application.
 * @param collection <string> - the name of the collection.
 * @returns <Promise<Array<QueryDocumentSnapshot<DocumentData>>>> - return all documents (if any).
 */
export const getAllCollectionDocs = async (
  firestoreDatabase: Firestore,
  collection: string
): Promise<Array<QueryDocumentSnapshot<DocumentData>>> =>
  (await getDocs(collectionRef(firestoreDatabase, collection))).docs
