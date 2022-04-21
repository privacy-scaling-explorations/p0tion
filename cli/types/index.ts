import { FirebaseApp } from "firebase/app"
import { DocumentData, FieldValue, Firestore, Timestamp } from "firebase/firestore"
import { Functions } from "firebase/functions"
import { FirebaseStorage } from "firebase/storage"

export enum CeremonyState {
  SCHEDULED = 1,
  OPENED = 2,
  PAUSED = 3,
  CLOSED = 4
}

export enum CeremonyType {
  PHASE1 = 1,
  PHASE2 = 2
}

export enum ParticipantStatus {
  CREATED = 1,
  WAITING = 2,
  READY = 3,
  CONTRIBUTING = 4,
  CONTRIBUTED = 5,
  OTHER = 6
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
  firebaseFunctions: Functions
}

export type LocalPathDirectories = {
  r1csDirPath: string
  metadataDirPath: string
  zkeysDirPath: string
  ptauDirPath: string
}

export type FirebaseDocumentInfo = {
  id: string
  data: DocumentData
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

export type CircuitInputData = {
  name: string
  description: string
  avgContributionTime: number
  sequencePosition?: number
  prefix?: string
}

export type Ceremony = {
  title: string
  description: string
  startDate: Timestamp
  endDate: Timestamp
  prefix: string
  state: CeremonyState
  type: CeremonyType
  coordinatorId: string
  lastUpdate?: FieldValue
}

export type CircuitMetadata = {
  curve: string
  wires: number
  constraints: number
  privateInputs: number
  publicOutputs: number
  labels: number
  outputs: number
  pot: number
}

export type Circuit = {
  name: string
  description: string
  prefix?: string
  avgContributionTime: number
  sequencePosition?: number
  metadata: CircuitMetadata
  ptauFilename?: string
  r1csBlake2bHash?: string
  zkeyBlake2bHash?: string
  ptauBlake2bHash?: string
  lastUpdate?: FieldValue
}
