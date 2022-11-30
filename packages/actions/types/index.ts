import { DocumentReference, DocumentData } from "firebase/firestore"

/** Enumeratives */
export enum CeremonyState {
    SCHEDULED = 1,
    OPENED = 2,
    PAUSED = 3,
    CLOSED = 4,
    FINALIZED = 5
}

export enum CeremonyType {
    PHASE1 = 1,
    PHASE2 = 2
}

export enum ProgressBarType {
    DOWNLOAD = 1,
    UPLOAD = 2
}

export enum ParticipantStatus {
    CREATED = 1,
    WAITING = 2,
    READY = 3,
    CONTRIBUTING = 4,
    CONTRIBUTED = 5,
    DONE = 6,
    FINALIZING = 7,
    FINALIZED = 8,
    TIMEDOUT = 9,
    EXHUMED = 10
}

export enum RequestType {
    PUT = 1,
    GET = 2
}

export enum ParticipantContributionStep {
    DOWNLOADING = 1,
    COMPUTING = 2,
    UPLOADING = 3,
    VERIFYING = 4,
    COMPLETED = 5
}

export enum TimeoutType {
    BLOCKING_CONTRIBUTION = 1,
    BLOCKING_CLOUD_FUNCTION = 2
}

export enum CeremonyTimeoutType {
    DYNAMIC = 1,
    FIXED = 2
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

export type UserDocumentData = {
    uid: string
    data: {
        name: string
        creationTime: number
        lastSignInTime: number
        lastUpdated: number
        email: string
        emailVerified: boolean
        photoURL?: string
    }
}

export type CeremonyDocumentData = {
    uid: string
    data: {
        coordinatorId: string
        title: string
        description: string
        prefix: string
        penalty: number
        startDate: number
        endDate: number
        state: CeremonyState
        type: CeremonyType
        timeoutType: CeremonyTimeoutType
        lastUpdated: number
    }
}

export type ParticipantDocumentData = {
    uid: string
    data: {
        userId: string
        contributionProgress: number
        status: ParticipantStatus
        contributions: Array<{
            doc: string
            computationTime: number
            hash: string
        }>
        lastUpdated: number
        contributionStartedAt: number
        contributionStep?: ParticipantContributionStep
        verificationStartedAt?: number
        tempContributionData?: {
            contributionComputationTime: number
            uploadId: string
            chunks: Array<{
                ETag: string
                PartNumber: number
            }>
        }
    }
}

export type CircuitDocumentData = {
    uid: string
    data: {
        name: string
        description: string
        prefix: string
        sequencePosition: number
        timeoutMaxContributionWaitingTime: number
        zKeySizeInBytes: number
        lastUpdated: number
        metadata: {
            constraints: number
            curve: string
            labels: number
            outputs: number
            pot: number
            privateInputs: number
            publicOutputs: number
            wires: number
        }
        template: {
            commitHash: string
            paramsConfiguration: Array<string | number>
            source: string
        }
        waitingQueue: {
            completedContributions: number
            contributors: Array<string>
            currentContributor: string
            failedContributions: number
        }
        files: {
            initialZkeyBlake2bHash: string
            initialZkeyFilename: string
            initialZkeyStoragePath: string
            potBlake2bHash: string
            potFilename: string
            potStoragePath: string
            r1csBlake2bHash: string
            r1csFilename: string
            r1csStoragePath: string
        }
        avgTimings: {
            contributionComputation: number
            fullContribution: number
            verifyCloudFunction: number
        }
        compiler: {
            commitHash: string
            version: string
        }
    }
}
