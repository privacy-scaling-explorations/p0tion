import admin from "firebase-admin"
import dotenv from "dotenv"
import { FirebaseApp, initializeApp } from "firebase/app"
import { Firestore, getFirestore } from "firebase/firestore"
import { Functions, getFunctions } from "firebase/functions"
import { getAuth, signInAnonymously, UserCredential } from "firebase/auth"

dotenv.config({ path: `${__dirname}/../../.env.test` })

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
    const adminApp = admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID })

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
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
    })

    // Init services.
    const userFirestore = getFirestore(userApp)
    const userFunctions = getFunctions(userApp)

    return {
        userApp,
        userFirestore,
        userFunctions
    }
}

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
