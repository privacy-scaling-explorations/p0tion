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
