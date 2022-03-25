import { FirebaseApp } from "firebase/app"
import { Firestore } from "firebase/firestore"
import { FirebaseStorage } from "firebase/storage"

// Custom type for Github OAuth 2.0 manual Device Flow request.
export type GithubOAuthRequest = {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

// Custom type for Github OAuth 2.0 manual Device Flow response.
export type GithubOAuthResponse = {
  clientSecret: string
  type: string
  tokenType: string
  clientType: string
  clientId: string
  token: string
  scopes: string[]
}

// Custom type for Firebase services used in the CLI.
export type FirebaseServices = {
  firebaseApp: FirebaseApp
  firestoreDatabase: Firestore
  firebaseStorage: FirebaseStorage
}

// TODO: forse ha senso suddividere i tipi per firebase / prompts etc.

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

// Core info for a ceremony.
export type Ceremony = {
  title: string
  description: string
  startDate: Date
  endDate: Date
  coordinatorId: string
  circuitsIds: Array<string>
}

// Core info for a circuit.
export type Circuit = {
  name: string
  description: string
  prefix: string
  constraints: number
  powers: number
  avgContributionTime: number
  sequencePosition: number
}

export type CeremonyInputData = {
  title: string
  description: string
  startDate: Date
  endDate: Date
  circuits: Array<Circuit>
}

export enum CeremonyState {
  SCHEDULED = 1,
  RUNNING = 2,
  PAUSED = 3,
  FINISHED = 4
}
