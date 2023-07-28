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
import { CeremonyState } from "../types/enums"
import { FirebaseDocumentInfo } from "../types/index"
import { commonTerms } from "./constants"

/**
 * Get participants collection path for database reference.
 * @notice all participants related documents are store under `ceremonies/<ceremonyId>/participants` collection path.
 * nb. This is a rule that must be satisfied. This is NOT an optional convention.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @returns <string> - the participants collection path.
 */
export const getParticipantsCollectionPath = (ceremonyId: string): string =>
    `${commonTerms.collections.ceremonies.name}/${ceremonyId}/${commonTerms.collections.participants.name}`

/**
 * Get circuits collection path for database reference.
 * @notice all circuits related documents are store under `ceremonies/<ceremonyId>/circuits` collection path.
 * nb. This is a rule that must be satisfied. This is NOT an optional convention.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @returns <string> - the participants collection path.
 */
export const getCircuitsCollectionPath = (ceremonyId: string): string =>
    `${commonTerms.collections.ceremonies.name}/${ceremonyId}/${commonTerms.collections.circuits.name}`

/**
 * Get contributions collection path for database reference.
 * @notice all contributions related documents are store under `ceremonies/<ceremonyId>/circuits/<circuitId>/contributions` collection path.
 * nb. This is a rule that must be satisfied. This is NOT an optional convention.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param circuitId <string> - the unique identifier of the circuit.
 * @returns <string> - the contributions collection path.
 */
export const getContributionsCollectionPath = (ceremonyId: string, circuitId: string): string =>
    `${getCircuitsCollectionPath(ceremonyId)}/${circuitId}/${commonTerms.collections.contributions.name}`

/**
 * Get timeouts collection path for database reference.
 * @notice all timeouts related documents are store under `ceremonies/<ceremonyId>/participants/<participantId>/timeouts` collection path.
 * nb. This is a rule that must be satisfied. This is NOT an optional convention.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param participantId <string> - the unique identifier of the participant.
 * @returns <string> - the timeouts collection path.
 */
export const getTimeoutsCollectionPath = (ceremonyId: string, participantId: string): string =>
    `${getParticipantsCollectionPath(ceremonyId)}/${participantId}/${commonTerms.collections.timeouts.name}`

/**
 * Helper for query a collection based on certain constraints.
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
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
    const snap = await getDocs(q)

    return snap
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
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
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
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @param collection <string> - the name of the collection.
 * @param documentId <string> - the unique identifier of the document in the collection.
 * @returns <Promise<DocumentSnapshot<DocumentData>>> - return the document from Firestore.
 */
export const getDocumentById = async (
    firestoreDatabase: Firestore,
    collection: string,
    documentId: string
): Promise<DocumentSnapshot<DocumentData>> => {
    const docRef = doc(firestoreDatabase, collection, documentId)

    return getDoc(docRef)
}

/**
 * Query for opened ceremonies.
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @returns <Promise<Array<FirebaseDocumentInfo>>>
 */
export const getOpenedCeremonies = async (firestoreDatabase: Firestore): Promise<Array<FirebaseDocumentInfo>> => {
    const runningStateCeremoniesQuerySnap = await queryCollection(
        firestoreDatabase,
        commonTerms.collections.ceremonies.name,
        [
            where(commonTerms.collections.ceremonies.fields.state, "==", CeremonyState.OPENED),
            where(commonTerms.collections.ceremonies.fields.endDate, ">=", Date.now())
        ]
    )

    return fromQueryToFirebaseDocumentInfo(runningStateCeremoniesQuerySnap.docs)
}

/**
 * Query for ceremony circuits.
 * @notice the order by sequence position is fundamental to maintain parallelism among contributions for different circuits.
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @param ceremonyId <string> - the ceremony unique identifier.
 * @returns Promise<Array<FirebaseDocumentInfo>> - the ceremony' circuits documents ordered by sequence position.
 */
export const getCeremonyCircuits = async (
    firestoreDatabase: Firestore,
    ceremonyId: string
): Promise<Array<FirebaseDocumentInfo>> =>
    fromQueryToFirebaseDocumentInfo(
        await getAllCollectionDocs(firestoreDatabase, getCircuitsCollectionPath(ceremonyId))
    ).sort((a: FirebaseDocumentInfo, b: FirebaseDocumentInfo) => a.data.sequencePosition - b.data.sequencePosition)

/**
 * Query for a specific ceremony' circuit contribution from a given contributor (if any).
 * @notice if the caller is a coordinator, there could be more than one contribution (= the one from finalization applies to this criteria).
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param circuitId <string> - the unique identifier of the circuit.
 * @param participantId <string> - the unique identifier of the participant.
 * @returns <Promise<Array<FirebaseDocumentInfo>>> - the document info about the circuit contributions from contributor.
 */
export const getCircuitContributionsFromContributor = async (
    firestoreDatabase: Firestore,
    ceremonyId: string,
    circuitId: string,
    participantId: string
): Promise<Array<FirebaseDocumentInfo>> => {
    const participantContributionsQuerySnap = await queryCollection(
        firestoreDatabase,
        getContributionsCollectionPath(ceremonyId, circuitId),
        [where(commonTerms.collections.contributions.fields.participantId, "==", participantId)]
    )

    return fromQueryToFirebaseDocumentInfo(participantContributionsQuerySnap.docs)
}

/**
 * Query for the active timeout from given participant for a given ceremony (if any).
 * @param ceremonyId <string> - the identifier of the ceremony.
 * @param participantId <string> - the identifier of the participant.
 * @returns <Promise<Array<FirebaseDocumentInfo>>> - the document info about the current active participant timeout.
 */
export const getCurrentActiveParticipantTimeout = async (
    firestoreDatabase: Firestore,
    ceremonyId: string,
    participantId: string
): Promise<Array<FirebaseDocumentInfo>> => {
    const participantTimeoutQuerySnap = await queryCollection(
        firestoreDatabase,
        getTimeoutsCollectionPath(ceremonyId, participantId),
        [where(commonTerms.collections.timeouts.fields.endDate, ">=", Timestamp.now().toMillis())]
    )

    return fromQueryToFirebaseDocumentInfo(participantTimeoutQuerySnap.docs)
}

/**
 * Query for the closed ceremonies.
 * @notice a ceremony is closed when the period for receiving new contributions has ended.
 * @dev when the ceremony is closed it becomes ready for finalization.
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @returns <Promise<Array<FirebaseDocumentInfo>>> - the list of closed ceremonies.
 */
export const getClosedCeremonies = async (firestoreDatabase: Firestore): Promise<Array<FirebaseDocumentInfo>> => {
    const closedCeremoniesQuerySnap = await queryCollection(
        firestoreDatabase,
        commonTerms.collections.ceremonies.name,
        [
            where(commonTerms.collections.ceremonies.fields.state, "==", CeremonyState.CLOSED),
            where(commonTerms.collections.ceremonies.fields.endDate, "<=", Date.now())
        ]
    )

    return fromQueryToFirebaseDocumentInfo(closedCeremoniesQuerySnap.docs)
}
