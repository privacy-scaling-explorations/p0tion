export enum CeremonyState {
    SCHEDULED = 1,
    OPENED = 2,
    PAUSED = 3,
    CLOSED = 4,
    FINALIZED = 5
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

export enum ParticipantContributionStep {
    DOWNLOADING = 1,
    COMPUTING = 2,
    UPLOADING = 3,
    VERIFYING = 4,
    COMPLETED = 5
}

export enum CeremonyType {
    PHASE1 = 1,
    PHASE2 = 2
}

export enum MsgType {
    INFO = 1,
    DEBUG = 2,
    WARN = 3,
    ERROR = 4,
    LOG = 5
}

export enum RequestType {
    PUT = 1,
    GET = 2
}

export enum TimeoutType {
    BLOCKING_CONTRIBUTION = 1,
    BLOCKING_CLOUD_FUNCTION = 2
}

export enum CeremonyTimeoutType {
    DYNAMIC = 1,
    FIXED = 2
}
