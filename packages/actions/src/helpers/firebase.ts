import { FirebaseApp, FirebaseOptions, initializeApp } from "firebase/app" // ref https://firebase.google.com/docs/web/setup#access-firebase.
import { User, getAuth, signInWithCredential, initializeAuth, OAuthCredential } from "firebase/auth"
import { Firestore, getFirestore } from "firebase/firestore"
import { Functions, getFunctions } from "firebase/functions"
import { FirebaseServices } from "../../types/index"

/**
 * This method initialize a Firebase app if no other app has already been initialized.
 * @param options <FirebaseOptions> - an object w/ every necessary Firebase option to init app.
 * @returns <FirebaseApp> - the initialized Firebase app object.
 */
const initializeFirebaseApp = (options: FirebaseOptions): FirebaseApp => initializeApp(options)

/**
 * This method returns the Firestore database instance associated to the given Firebase application.
 * @param app <FirebaseApp> - the Firebase application.
 * @returns <Firestore> - the Firebase Firestore associated to the application.
 */
const getFirestoreDatabase = (app: FirebaseApp): Firestore => getFirestore(app)

/**
 * This method returns the Cloud Functions instance associated to the given Firebase application.
 * @param app <FirebaseApp> - the Firebase application.
 * @returns <Functions> - the Cloud Functions associated to the application.
 */
const getFirebaseFunctions = (app: FirebaseApp): Functions => getFunctions(app)

/**
 * Return the core Firebase services instances (App, Database, Functions).
 * @param apiKey <string> - the API key specified in the application config.
 * @param authDomain <string> - the authDomain string specified in the application config.
 * @param projectId <string> - the projectId specified in the application config.
 * @param messagingSenderId <string> - the messagingSenderId specified in the application config.
 * @param appId <string> - the appId specified in the application config.
 * @returns <Promise<FirebaseServices>>
 */
export const initializeFirebaseCoreServices = async (
    apiKey: string,
    authDomain: string,
    projectId: string,
    messagingSenderId: string,
    appId: string
): Promise<FirebaseServices> => {
    const firebaseApp = initializeFirebaseApp({
        apiKey,
        authDomain,
        projectId,
        messagingSenderId,
        appId
    })
    const firestoreDatabase = getFirestoreDatabase(firebaseApp)
    const firebaseFunctions = getFirebaseFunctions(firebaseApp)

    return {
        firebaseApp,
        firestoreDatabase,
        firebaseFunctions
    }
}

/**
 * Sign in w/ OAuth 2.0 token.
 * @param firebaseApp <FirebaseApp> - the configured instance of the Firebase App in use.
 * @param credentials <OAuthCredential> - the OAuth credential generated from token exchange.
 */
export const signInToFirebaseWithCredentials = async (firebaseApp: FirebaseApp, credentials: OAuthCredential) =>
    signInWithCredential(initializeAuth(firebaseApp), credentials)

/**
 * Return the current authenticated user in the given Firebase Application.
 * @param firebaseApp <FirebaseApp> - the configured instance of the Firebase App in use.
 * @returns <User> - the object containing the data about the current authenticated user in the given Firebase application.
 */
export const getCurrentFirebaseAuthUser = (firebaseApp: FirebaseApp): User => {
    const user = getAuth(firebaseApp).currentUser

    if (!user)
        throw new Error(
            `Unable to find the user currently authenticated with Firebase. Verify that the Firebase application is properly configured and repeat user authentication before trying again.`
        )

    return user
}
