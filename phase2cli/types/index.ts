import { FirebaseApp } from "firebase/app"
import { DocumentData, DocumentReference, Firestore } from "firebase/firestore"
import { Functions } from "firebase/functions"
import { FirebaseStorage } from "firebase/storage"
import { User as FirebaseAuthUser } from "firebase/auth"

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

export type AuthUser = {
  user: FirebaseAuthUser
  ghToken: string
  ghUsername: string
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
    potFilename: string
    r1csFilename: string
    initialZkeyFilename: string
    potStoragePath: string
    r1csStoragePath: string
    initialZkeyStoragePath: string
    potBlake2bHash: string
    r1csBlake2bHash: string
    initialZkeyBlake2bHash: string
  }
}

export type CircuitTimings = {
  avgTimings?: {
    contributionComputation: number
    fullContribution: number
    verifyCloudFunction: number
  }
}

export type Circuit = CircuitInputData &
  CircuitFiles &
  CircuitTimings & {
    metadata: CircuitMetadata
    lastUpdated?: number
  }

export type Timing = {
  seconds: number
  minutes: number
  hours: number
  days: number
}

export type VerifyContributionComputation = {
  valid: boolean
  verificationComputationTime: number
  verifyCloudFunctionTime: number
  fullContributionTime: number
}

export type ChunkWithUrl = {
  partNumber: number
  chunk: Buffer
  preSignedUrl: string
}

export type ETagWithPartNumber = {
  ETag: string | null
  PartNumber: number
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
