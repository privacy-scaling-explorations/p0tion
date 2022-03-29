import { FirebaseApp } from "firebase/app"
import { FieldValue, Firestore, Timestamp } from "firebase/firestore"
import { FirebaseStorage } from "firebase/storage"

export enum CeremonyState {
  SCHEDULED = 1,
  RUNNING = 2,
  PAUSED = 3,
  FINISHED = 4
}

export type GithubOAuthRequest = {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export type GithubOAuthResponse = {
  clientSecret: string
  type: string
  tokenType: string
  clientType: string
  clientId: string
  token: string
  scopes: string[]
}

export type FirebaseServices = {
  firebaseApp: FirebaseApp
  firestoreDatabase: Firestore
  firebaseStorage: FirebaseStorage
}

export type User = {
  name: string
  username: string
  providerId: string
  createdAt: Date
  lastLoginAt: Date
}

export type Coordinator = {
  userId: string
  ceremoniesIds: string[]
}
export type CeremonyInputData = {
  title: string
  description: string
  startDate: Timestamp
  endDate: Timestamp
}

export type Ceremony = {
  title: string
  description: string
  startDate: Timestamp
  endDate: Timestamp
  state: CeremonyState
  coordinatorId: string
  lastUpdate?: FieldValue
}

export type Circuit = {
  name: string
  description: string
  prefix: string
  constraints: number
  powers: number
  avgContributionTime: number
  sequencePosition: number
  lastUpdate?: FieldValue
}
