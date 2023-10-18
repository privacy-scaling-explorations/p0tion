import { FirebaseApp, FirebaseOptions, initializeApp } from "firebase/app" // ref https://firebase.google.com/docs/web/setup#access-firebase.
import { Firestore, getFirestore } from "firebase/firestore"
import { Functions, getFunctions } from "firebase/functions"
import { AWSVariables, FirebaseServices } from "../types/index"

/**
 * This method initialize a Firebase app if no other app has already been initialized.
 * @param options <FirebaseOptions> - an object w/ every necessary Firebase option to init app.
 * @returns <FirebaseApp> - the initialized Firebase app object.
 */
export const initializeFirebaseApp = (options: FirebaseOptions): FirebaseApp => initializeApp(options)

/**
 * This method returns the Firestore database instance associated to the given Firebase application.
 * @param app <FirebaseApp> - the Firebase application.
 * @returns <Firestore> - the Firebase Firestore associated to the application.
 */
export const getFirestoreDatabase = (app: FirebaseApp): Firestore => getFirestore(app)

/**
 * This method returns the Cloud Functions instance associated to the given Firebase application.
 * @param app <FirebaseApp> - the Firebase application.
 * @returns <Functions> - the Cloud Functions associated to the application.
 */
export const getFirebaseFunctions = (app: FirebaseApp): Functions => getFunctions(app, "europe-west1")

/**
 * Retrieve the configuration variables for the AWS services (S3, EC2).
 * @returns <AWSVariables> - the values of the AWS services configuration variables.
 */
export const getAWSVariables = (): AWSVariables => {
    if (
        !process.env.AWS_ACCESS_KEY_ID ||
        !process.env.AWS_SECRET_ACCESS_KEY ||
        !process.env.AWS_REGION ||
        !process.env.AWS_ROLE_ARN ||
        !process.env.AWS_AMI_ID
    )
        throw new Error(
            "Could not retrieve the AWS environment variables. Please, verify your environment configuration and retry"
        )

    return {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        region: process.env.AWS_REGION || "us-east-1",
        roleArn: process.env.AWS_ROLE_ARN!,
        amiId: process.env.AWS_AMI_ID!
    }
}

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
