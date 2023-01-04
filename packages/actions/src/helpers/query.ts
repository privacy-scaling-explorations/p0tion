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
import { CeremonyState, FirebaseDocumentInfo } from "../../types/index"
import {
    ceremoniesCollectionFields,
    collections,
    contributionsCollectionFields,
    timeoutsCollectionFields
} from "./constants"

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
    queryDocSnap.map((document: QueryDocumentSnapshot<DocumentData>) => ({
        id: document.id,
        ref: document.ref,
        data: document.data()
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

/**
 * Query for closed ceremonies documents and return their data (if any).
 * @param firestoreDatabase <Firestore> - the Firestore database to query.
 * @returns <Promise<Array<FirebaseDocumentInfo>>>
 */
export const getClosedCeremonies = async (firestoreDatabase: Firestore): Promise<Array<FirebaseDocumentInfo>> => {
    let closedStateCeremoniesQuerySnap: any

    try {
        closedStateCeremoniesQuerySnap = await queryCollection(firestoreDatabase, collections.ceremonies, [
            where(ceremoniesCollectionFields.state, "==", CeremonyState.CLOSED),
            where(ceremoniesCollectionFields.endDate, "<=", Date.now())
        ])

        if (closedStateCeremoniesQuerySnap.empty && closedStateCeremoniesQuerySnap.size === 0)
            throw new Error("Queries-0001: There are no ceremonies ready to finalization")
    } catch (err: any) {
        throw new Error(err.toString())
    }

    return fromQueryToFirebaseDocumentInfo(closedStateCeremoniesQuerySnap.docs)
}
