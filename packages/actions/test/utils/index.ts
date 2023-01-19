import admin from "firebase-admin"
import dotenv from "dotenv"
import { FirebaseApp, getApp, initializeApp } from "firebase/app"
import { connectFirestoreEmulator, Firestore, getFirestore } from "firebase/firestore"
import { connectFunctionsEmulator, Functions, getFunctions } from "firebase/functions"
import {
    connectAuthEmulator,
    createUserWithEmailAndPassword,
    getAuth,
    signInAnonymously,
    UserCredential
} from "firebase/auth"
import { TestingEnvironment } from "../../types"

dotenv.config({ path: `${__dirname}/../../.env.test` })

// Emulator data.
const emulatorApiKey = "AAaaAaAaaaAa11aAAAaAA_1AaAaAaAaAAAa1A1a"
// WARNING: DO NOT USE PROD HERE OR YOUR CONFIGS MAY BE EXPOSED.
// nb. This MUST match the "dev" project stored in `/packages/backend/.firebaserc`.
const emulatorProjectId = "demo-zkmpc"

// Env type.
export const envType = process.env.NODE_ENV === "prod" ? TestingEnvironment.PRODUCTION : TestingEnvironment.DEVELOPMENT

/**
 * Initialize and return the Admin SDK app and services.
 * @returns <App, Firestore, Auth, SecurityRules> - the instance of the initialized admin app and services.
 */
export const initializeAdminServices = (): {
    adminApp: admin.app.App
    adminFirestore: admin.firestore.Firestore
    adminAuth: admin.auth.Auth
    adminSecurityRules: admin.securityRules.SecurityRules
} => {
    // Init app.
    const adminApp = admin.initializeApp({
        projectId: envType === TestingEnvironment.PRODUCTION ? process.env.FIREBASE_PROJECT_ID : emulatorProjectId
    })

    // Init services.
    const adminFirestore = admin.firestore()
    const adminAuth = admin.auth()
    const adminSecurityRules = admin.securityRules()

    return {
        adminApp,
        adminFirestore,
        adminAuth,
        adminSecurityRules
    }
}

/**
 * Initialize and return the Firebase app and services.
 * @returns <App, Firestore, Functions> - the instance of the initialized Firebase app and services.
 */
export const initializeUserServices = (): {
    userApp: FirebaseApp
    userFirestore: Firestore
    userFunctions: Functions
} => {
    // Init app.
    const userApp = initializeApp({
        apiKey: envType === TestingEnvironment.PRODUCTION ? process.env.FIREBASE_API_KEY : emulatorApiKey, // dummy fallback for dev (emulator).
        projectId: envType === TestingEnvironment.PRODUCTION ? process.env.FIREBASE_PROJECT_ID : emulatorProjectId,
        authDomain: envType === TestingEnvironment.PRODUCTION ? process.env.FIREBASE_AUTH_DOMAIN : "", // not needed fallback for dev.
        messagingSenderId: envType === TestingEnvironment.PRODUCTION ? process.env.FIREBASE_MESSAGING_SENDER_ID : "", // not needed fallback for dev.
        appId: envType === TestingEnvironment.PRODUCTION ? process.env.FIREBASE_APP_ID : "" // not needed fallback for dev.
    })

    // Init services.
    const auth = getAuth(userApp)
    const userFirestore = envType === TestingEnvironment.PRODUCTION ? getFirestore(userApp) : getFirestore()
    const userFunctions = envType === TestingEnvironment.PRODUCTION ? getFunctions(userApp) : getFunctions(getApp())

    if (envType === TestingEnvironment.DEVELOPMENT) {
        // Connect the emulator for dev environment (default endpoints).
        connectAuthEmulator(auth, "http://localhost:9099")
        connectFirestoreEmulator(userFirestore, "localhost", 8080)
        connectFunctionsEmulator(userFunctions, "localhost", 5001)
    }

    return {
        userApp,
        userFirestore,
        userFunctions
    }
}

/**
 * Get necessary information for correctly config the storage module.
 * @returns <number, string, number> - the necessary information for configuring storage module (AWS S3).
 */
export const getStorageConfiguration = (): {
    streamChunkSizeInMb: number
    ceremonyBucketPostfix: string
    presignedUrlExpirationInSeconds: number
} => ({
    streamChunkSizeInMb: Number(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB) || 50,
    ceremonyBucketPostfix: process.env.CONFIG_CEREMONY_BUCKET_POSTFIX || "-ph2-ceremony",
    presignedUrlExpirationInSeconds: Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS) || 7200
})

/**
 * Get necessary information for correctly config the authentication module.
 * @returns <string> - the necessary information for dealing with the authentication.
 */
export const getAuthenticationConfiguration = (): {
    githubClientId: string
    userEmail: string
    githubUserPw: string
    gmailUserPw: string
} => ({
    githubClientId: String(process.env.AUTH_GITHUB_CLIENT_ID),
    userEmail: String(process.env.AUTH_USER_EMAIL),
    githubUserPw: String(process.env.AUTH_GITHUB_USER_PW),
    gmailUserPw: String(process.env.AUTH_GMAIL_USER_PW)
})

/**
 * Create a new Firebase user account with specified email and password.
 * @notice On successful creation of the user account, this user will also be signed in to your application.
 * @dev The pw MUST not be the one used for login with the email on Google or other email providers. The pw is only valid for authentication with Firebase.
 * @param userApp <FirebaseApp> - the initialized instance of the Firebase app.
 * @param email <string> - the personal user email.
 * @param pw <string> - a password to be associated with the user personal email here in Firebase.
 * @returns <Promise<UserCredential>>
 */
export const createNewFirebaseUserWithEmailAndPw = async (
    userApp: FirebaseApp,
    email: string,
    pw: string
): Promise<UserCredential> => createUserWithEmailAndPassword(getAuth(userApp), email, pw)

/**
 * Do the sign-in anonymously for a given Firebase app.
 * @param userApp <FirebaseApp> - the initialized instance of the Firebase app.
 * @returns
 */
export const signInAnonymouslyWithUser = async (
    userApp: FirebaseApp
): Promise<{
    userCredentials: UserCredential
    newUid: string
}> => {
    // Sign in anonymously.
    const auth = getAuth(userApp)
    const userCredentials = await signInAnonymously(auth)

    // Get new uid.
    const newUid = userCredentials.user.uid

    return {
        userCredentials,
        newUid
    }
}

/**
 * Delete all initialized apps using the Admin SDK.
 */
export const deleteAdminApp = async () => {
    await Promise.all(admin.apps.map((app) => app?.delete()))
}

/**
 * Sleeps the function execution for given millis.
 * @dev to be used in combination with loggers when writing data into files.
 * @param ms <number> - sleep amount in milliseconds
 * @returns <Promise<any>>
 */
export const sleep = (ms: any) => new Promise((resolve) => setTimeout(resolve, ms))
