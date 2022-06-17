import { FirebaseApp } from "firebase/app"
import { DocumentData, DocumentReference, Firestore } from "firebase/firestore"
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
  ref: DocumentReference<DocumentData>
  data: DocumentData
}

export type User = {
  name: string
  username: string
  providerId: string
  createdAt: Date
  lastLoginAt: Date
}

export type CeremonyInputData = {
  title: string
  description: string
  startDate: Date
  endDate: Date
}

export type CircuitInputData = {
  name?: string
  description: string
  sequencePosition?: number
  prefix?: string
}

export type Ceremony = CeremonyInputData & {
  prefix: string
  state: CeremonyState
  type: CeremonyType
  coordinatorId: string
  lastUpdated: number
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

export type CircuitFiles = {
  files?: {
    ptauFilename: string
    r1csFilename: string
    initialZkeyFilename: string
    ptauStoragePath: string
    r1csStoragePath: string
    initialZkeyStoragePath: string
    ptauBlake2bHash: string
    r1csBlake2bHash: string
    initialZkeyBlake2bHash: string
  }
}

export type CircuitTimings = {
  avgTimings?: {
    avgContributionTime: number
    avgVerificationTime: number
  }
}

export type Circuit = CircuitInputData &
  CircuitFiles &
  CircuitTimings & {
    metadata: CircuitMetadata
    lastUpdated?: number
  }
