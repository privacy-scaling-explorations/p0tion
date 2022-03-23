import { FirebaseServices } from "cli/types"
import { FirebaseApp, FirebaseOptions, initializeApp } from "firebase/app"
import { doc, DocumentData, DocumentSnapshot, Firestore, getDoc, getFirestore } from "firebase/firestore"
import { FirebaseStorage, getStorage } from "firebase/storage"

/** Firebase App and services */
let firebaseApp: FirebaseApp
let firestoreDatabase: Firestore
let firebaseStorage: FirebaseStorage

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
const getFirestoreDatabase = (app: FirebaseApp): Firestore => {
  if (app.options.databaseURL !== `${`${app.options.projectId}.firebaseio.com`}`)
    throw new Error("Please, check that all FIREBASE variables in the .env file are set correctly.")

  return getFirestore(app)
}

/**
 * This method returns the Firestore storage instance associated to the given Firebase application.
 * @param app <FirebaseApp> - the Firebase application.
 * @returns <Firestore> - the Firebase Storage associated to the application.
 */
const getFirebaseStorage = (app: FirebaseApp): FirebaseStorage => {
  if (app.options.storageBucket !== `${`${app.options.projectId}.appspot.com`}`)
    throw new Error("Please, check that all FIREBASE variables in the .env file are set correctly.")

  return getStorage(app)
}

/**
 * Initialize each Firebase service.
 * @returns <Promise<FirebaseServices>> - the initialized Firebase services.
 */
export const initServices = async (): Promise<FirebaseServices> => {
  if (
    !process.env.FIREBASE_API_KEY ||
    !process.env.FIREBASE_AUTH_DOMAIN ||
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_STORAGE_BUCKET ||
    !process.env.FIREBASE_MESSAGING_SENDER_ID ||
    !process.env.FIREBASE_APP_ID ||
    !process.env.FIREBASE_FIRESTORE_DATABASE_URL
  )
    throw new Error("Please, check that all FIREBASE_ variables in the .env file are set correctly.")

  firebaseApp = initializeFirebaseApp({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    databaseURL: process.env.FIREBASE_FIRESTORE_DATABASE_URL
  })
  firestoreDatabase = getFirestoreDatabase(firebaseApp)
  firebaseStorage = getFirebaseStorage(firebaseApp)

  return {
    firebaseApp,
    firestoreDatabase,
    firebaseStorage
  }
}

/**
 * Get a specific document from database.
 * @param collection <string> - the name of the collection.
 * @param documentUID <string> - the unique identifier of the document in the collection.
 * @returns <Promise<DocumentSnapshot<DocumentData>>> - return the document from Firestore.
 */
export const readDocumentFromDb = async (
  collection: string,
  documentUID: string
): Promise<DocumentSnapshot<DocumentData>> => {
  const docRef = doc(firestoreDatabase, collection, documentUID)

  return getDoc(docRef)
}

/**
 * Get the user' role from the database.
 * @param userUID <string> - the unique identifier of the user document in the users collection.
 * @returns <Promise<string> - return the role of the user.
 */
export const getUserRoleFromDb = async (userUID: string): Promise<string> => {
  const docData = (await readDocumentFromDb("users", userUID)).data()

  if (docData) return docData.role
  throw new Error(`There was an error retrieving your role. Please try again later.`)
}
