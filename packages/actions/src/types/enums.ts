/**
 * Define different states of a ceremony.
 * @enum {string}
 * - SCHEDULED: when the ceremony setup has been properly completed but the contribution period has not yet started.
 * - OPENED: when the contribution period has started.
 * - PAUSED: When the coordinator has manually paused the ceremony (NB. currently not possible because the relevant functionality has not yet been implemented).
 * - CLOSED: when the contribution period has finished.
 * - FINALIZED: when the ceremony finalization has been properly completed.
 */
export const enum CeremonyState {
    SCHEDULED = "SCHEDULED",
    OPENED = "OPENED",
    PAUSED = "PAUSED",
    CLOSED = "CLOSED",
    FINALIZED = "FINALIZED"
}

/**
 * Define the type of Trusted Setup ceremony (Phase 1 or Phase 2).
 * @enum {string}
 * - PHASE1: when the ceremony is a Phase 1 Trusted Setup ceremony.
 * - PHASE2: when the ceremony is a Phase 2 Trusted Setup ceremony.
 */
export const enum CeremonyType {
    PHASE1 = "PHASE1",
    PHASE2 = "PHASE2"
}

/**
 * Define different status of a participant.
 * @enum {string}
 * - CREATED: when the participant document has been created in the database.
 * - WAITING: when the participant is waiting for a contribution (i.e., is currently queued or is waiting for its status to be checked after a timeout expiration).
 * - READY: when the participant is ready for a contribution.
 * - CONTRIBUTING: when the participant is currently contributing (i.e., not queued anymore, but the current contributor at this time).
 * - CONTRIBUTED: when the participant has completed successfully the contribution for all circuits in a ceremony. The participant may need to wait for the latest contribution verification while having this status.
 * - DONE: when the participant has completed contributions and verifications from coordinator.
 * - FINALIZING: when the coordinator is currently finalizing the ceremony.
 * - FINALIZED: when the coordinator has successfully finalized the ceremony.
 * - TIMEDOUT: when the participant has been timedout while contributing. This may happen due to network or memory issues, un/intentional crash, or contributions lasting for too long.
 * - EXHUMED: when the participant is ready to resume the contribution after a timeout expiration.
 */
export const enum ParticipantStatus {
    CREATED = "CREATED",
    WAITING = "WAITING",
    READY = "READY",
    CONTRIBUTING = "CONTRIBUTING",
    CONTRIBUTED = "CONTRIBUTED",
    DONE = "DONE",
    FINALIZING = "FINALIZING",
    FINALIZED = "FINALIZED",
    TIMEDOUT = "TIMEDOUT",
    EXHUMED = "EXHUMED"
}

/**
 * Define different steps during which the participant may be during the contribution.
 * @enum {string}
 * - DOWNLOADING: when the participant is doing the download of the last contribution (from previous participant).
 * - COMPUTING: when the participant is actively computing the contribution.
 * - UPLOADING: when the participant is uploading the computed contribution.
 * - VERIFYING: when the participant is waiting from verification results from the coordinator.
 * - COMPLETED: when the participant has received the verification results from the coordinator and completed the contribution steps.
 */
export const enum ParticipantContributionStep {
    DOWNLOADING = "DOWNLOADING",
    COMPUTING = "COMPUTING",
    UPLOADING = "UPLOADING",
    VERIFYING = "VERIFYING",
    COMPLETED = "COMPLETED"
}

/**
 * Define what type of timeout was performed.
 * @enum {string}
 * - BLOCKING_CONTRIBUTION: when the current contributor was blocking the waiting queue.
 * - BLOCKING_CLOUD_FUNCTION: when the contribution verification has gone beyond the time limit.
 */
export const enum TimeoutType {
    BLOCKING_CONTRIBUTION = "BLOCKING_CONTRIBUTION",
    BLOCKING_CLOUD_FUNCTION = "BLOCKING_CLOUD_FUNCTION"
}

/**
 * Define what type of timeout mechanism is currently adopted for a ceremony.
 * @enum {string}
 * - DYNAMIC: self-update approach based on latest contribution time.
 * - FIXED: approach based on a fixed amount of time.
 */
export const enum CeremonyTimeoutType {
    DYNAMIC = "DYNAMIC",
    FIXED = "FIXED"
}

/**
 * Define request type for pre-signed urls.
 */
export const enum RequestType {
    PUT = "PUT",
    GET = "GET"
}

/**
 * Define the environment in use when testing.
 * @enum {string}
 * - DEVELOPMENT: tests are performed on the local Firebase emulator instance.
 * - PRODUCTION: tests are performed on the remote (deployed) Firebase application.
 */
export const enum TestingEnvironment {
    DEVELOPMENT = "DEVELOPMENT",
    PRODUCTION = "PRODUCTION"
}

/**
 * Define what type of contribution verification mechanism is currently adopted for a circuit.
 * @enum {string}
 * - CF: Cloud Functions.
 * - VM: Virtual Machine.
 */
export const enum CircuitContributionVerificationMechanism {
    CF = "CF",
    VM = "VM"
}

/**
 * Define the supported VM volume types.
 * @dev the VM volume types can be retrieved at https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ebs-volume-types.html
 * @enum {string}
 * - GP2: General Purpose SSD version 2.
 * - GP3: General Purpose SSD version 3.
 * - IO1: Provisioned IOPS SSD volumes version 1.
 * - ST1: Throughput Optimized HDD volumes.
 * - SC1: Cold HDD volumes.
 */
export const enum DiskTypeForVM {
    GP2 = "gp2",
    GP3 = "gp3",
    IO1 = "io1",
    ST1 = "st1",
    SC1 = "sc1"
}
