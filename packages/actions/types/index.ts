import { DocumentReference, DocumentData } from "firebase/firestore"

/** Enumeratives */
export const enum CeremonyState {
    SCHEDULED = 1,
    OPENED = 2,
    PAUSED = 3,
    CLOSED = 4,
    FINALIZED = 5
}

export const enum Collections {
    USERS = "users",
    PARTICIPANTS = "participants",
    CEREMONIES = "ceremonies",
    CIRCUITS = "circuits",
    CONTRIBUTIONS = "contributions",
    TIMEOUTS = "timeouts"
}

export const enum CeremonyCollectionField {
    COORDINATOR_ID = "coordinatorId",
    DESCRIPTION = "description",
    START_DATE = "startDate",
    END_DATE = "endDate",
    LAST_UPDATED = "lastUpdated",
    PREFIX = "prefix",
    STATE = "state",
    TITLE = "title",
    TYPE = "type"
}

/** Types */
export type FirebaseDocumentInfo = {
    id: string
    ref: DocumentReference<DocumentData>
    data: DocumentData
}
