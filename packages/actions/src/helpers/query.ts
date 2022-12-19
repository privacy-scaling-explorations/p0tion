import {
    collection as collectionRef,
    doc,
    DocumentData,
    DocumentSnapshot,
    Firestore,
    getDoc,
    getDocs,
    query,
    QueryConstraint,
    QueryDocumentSnapshot,
    QuerySnapshot,
    Timestamp,
    where
} from "firebase/firestore"
import { FirebaseDocumentInfo } from "../../types/index"
import { collections, contributionsCollectionFields, timeoutsCollectionFields } from "./constants"

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


/**
 * Get a specific document from database.
 * @param firestoreDatabase <Firestore> - the firestore db.
 * @param collection <string> - the name of the collection.
 * @param documentUID <string> - the unique identifier of the document in the collection.
 * @returns <Promise<DocumentSnapshot<DocumentData>>> - return the document from Firestore.
 */
export const getDocumentById = async (
    firestoreDatabase: Firestore,
    collection: string,
    documentUID: string
): Promise<DocumentSnapshot<DocumentData>> => {
    const docRef = doc(firestoreDatabase, collection, documentUID)

    return getDoc(docRef)
}


/**
 * Query for contribution from given participant for a given circuit (if any).
 * @param firestoreDatabase <Firestore> - the database to query.
 * @param ceremonyId <string> - the identifier of the ceremony.
 * @param circuitId <string> - the identifier of the circuit.
 * @param participantId <string> - the identifier of the participant.
 * @returns <Promise<Array<FirebaseDocumentInfo>>>
 */
export const getCurrentContributorContribution = async (
    firestoreDatabase: Firestore,
    ceremonyId: string,
    circuitId: string,
    participantId: string
): Promise<Array<FirebaseDocumentInfo>> => {
    const participantContributionQuerySnap = await queryCollection(
        firestoreDatabase,
        `${collections.ceremonies}/${ceremonyId}/${collections.circuits}/${circuitId}/${collections.contributions}`,
        [where(contributionsCollectionFields.participantId, "==", participantId)]
    )

    return fromQueryToFirebaseDocumentInfo(participantContributionQuerySnap.docs)
}

/**
 * Query for the active timeout from given participant for a given ceremony (if any).
 * @param ceremonyId <string> - the identifier of the ceremony.
 * @param participantId <string> - the identifier of the participant.
 * @returns Promise<Array<FirebaseDocumentInfo>>
 */
export const getCurrentActiveParticipantTimeout = async (
    firestoreDatabase: Firestore,
    ceremonyId: string,
    participantId: string
): Promise<Array<FirebaseDocumentInfo>> => {
    const participantTimeoutQuerySnap = await queryCollection(
        firestoreDatabase,
        `${collections.ceremonies}/${ceremonyId}/${collections.participants}/${participantId}/${collections.timeouts}`,
        [where(timeoutsCollectionFields.endDate, ">=", Timestamp.now().toMillis())]
    )

    return fromQueryToFirebaseDocumentInfo(participantTimeoutQuerySnap.docs)
}