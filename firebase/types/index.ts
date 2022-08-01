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
  FINALIZING = 6,
  FINALIZED = 7,
  TIMEDOUT = 8
}

export enum CeremonyType {
  PHASE1 = 1,
  PHASE2 = 2
}
