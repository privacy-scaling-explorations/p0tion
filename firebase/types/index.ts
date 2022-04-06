import admin from "firebase-admin"

export enum CeremonyState {
  SCHEDULED = 1,
  RUNNING = 2,
  PAUSED = 3,
  FINISHED = 4
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
