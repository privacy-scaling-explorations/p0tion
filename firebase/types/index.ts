import admin from "firebase-admin"

export enum CeremonyState {
  SCHEDULED = 1,
  OPENED = 2,
  PAUSED = 3,
  CLOSED = 4
}

export enum ParticipantStatus {
  WAITING = 1,
  READY = 2,
  CONTRIBUTING = 3,
  CONTRIBUTED = 4
}

export type WaitingQueue = {
  contributors: Array<string>
  currentContributor: string
  lastContributor: string
  nextContributor: string
  completedContributions: number // == nextZkeyIndex.
  waitingContributions: number
  failedContributions: number
  lastUpdated: admin.firestore.Timestamp
}
