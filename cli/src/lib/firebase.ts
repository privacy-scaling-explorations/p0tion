import { FirebaseApp, FirebaseOptions, initializeApp } from "firebase/app"
import {
  addDoc,
  collection as collectionRef,
  doc,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  getDoc,
  getDocs,
  getFirestore,
  query,
  QueryConstraint,
  QueryDocumentSnapshot,
  QuerySnapshot,
  setDoc
} from "firebase/firestore"
import { Functions, getFunctions } from "firebase/functions"
import { FirebaseStorage, getBytes, getDownloadURL, getStorage, ref, uploadBytes, UploadResult } from "firebase/storage"
import { readFileSync } from "fs"
import { FirebaseServices } from "../../types/index.js"

/** Firebase App and services */
let firebaseApp: FirebaseApp
let firestoreDatabase: Firestore
let firebaseStorage: FirebaseStorage
let firebaseFunctions: Functions

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
 * This method returns the Cloud Functions instance associated to the given Firebase application.
 * @param app <FirebaseApp> - the Firebase application.
 * @returns <Functions> - the Cloud Functions associated to the application.
 */
const getFirebaseFunctions = (app: FirebaseApp): Functions => getFunctions(app)

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
  firebaseFunctions = getFirebaseFunctions(firebaseApp)

  return {
    firebaseApp,
    firestoreDatabase,
    firebaseStorage,
    firebaseFunctions
  }
}

/**
 * Store a document on Firestore.
 * @param collection <string> - the name of the collection.
 * @param data <DocumentData> - the data to be stored.
 * @param merge <boolean> - If true merge document fields, otherwise false (needed only when documentUID is provided).
 * @param documentUID <string> - optional document uid.
 * @returns <Promise<DocumentReference>>
 */
export const setDocument = async (
  collection: string,
  data: DocumentData,
  merge: boolean = false,
  documentUID?: string
): Promise<DocumentReference> => {
  if (!documentUID)
    // Auto-generated document UID.
    return addDoc(collectionRef(firestoreDatabase, collection), data)

  // Get doument reference by UID.
  const docRef = doc(firestoreDatabase, collection, documentUID)

  // Store.
  await setDoc(docRef, data, { merge })

  return docRef
}

/**
 * Get a specific document from database.
 * @param collection <string> - the name of the collection.
 * @param documentUID <string> - the unique identifier of the document in the collection.
 * @returns <Promise<DocumentSnapshot<DocumentData>>> - return the document from Firestore.
 */
export const getDocumentById = async (
  collection: string,
  documentUID: string
): Promise<DocumentSnapshot<DocumentData>> => {
  const docRef = doc(firestoreDatabase, collection, documentUID)

  return getDoc(docRef)
}

/**
 * Query a collection to get matching documents.
 * @param collection <string> - the name of the collection.
 * @param queryConstraints <Array<QueryConstraint>> - a sequence of where conditions.
 * @returns <Promise<QuerySnapshot<DocumentData>>> - return the matching documents (if any).
 */
export const queryCollection = async (
  collection: string,
  queryConstraints: Array<QueryConstraint>
): Promise<QuerySnapshot<DocumentData>> => {
  // Make a query.
  const q = query(collectionRef(firestoreDatabase, collection), ...queryConstraints)

  // Get docs.
  return getDocs(q)
}

/**
 * Get all documents in a collection.
 * @param collection <string> - the name of the collection.
 * @returns <Promise<Array<QueryDocumentSnapshot<DocumentData>>>> - return all documents (if any).
 */
export const getAllCollectionDocs = async (collection: string): Promise<Array<QueryDocumentSnapshot<DocumentData>>> =>
  (await getDocs(collectionRef(firestoreDatabase, collection))).docs

/**
 * Download locally a zkey file from storage.
 * @param path <string> - path where the zkey file is going to be stored.
 * @returns <Promise<any>>
 */
export const downloadFileFromStorage = async (path: string): Promise<Buffer> => {
  // Create a reference with folder path.
  const pathReference = ref(firebaseStorage, path)

  // Bufferized file content.
  return Buffer.from(await getBytes(pathReference))
}

/**
 * Upload a file to storage.
 * @param localPath <string> - path where the file is locally stored.
 * @param storagePath <string> - path where the file will be stored in the storage service.
 * @returns <Promise<any>>
 */
export const uploadFileToStorage = async (localPath: string, storagePath: string): Promise<UploadResult> => {
  // Create a reference with folder path.
  const pathReference = ref(firebaseStorage, storagePath)

  return uploadBytes(pathReference, readFileSync(localPath))
}

/**
 * Check if a file exists in the storage.
 * @dev ask for a url to download the file. If it exists, the file exists! Otherwise, not.
 * @param pathToFile <string> - the path to the file in the storage.
 * @returns
 */
export const checkIfStorageFileExists = async (pathToFile: string): Promise<boolean> => {
  try {
    // Get a reference.
    const pathReference = ref(firebaseStorage, pathToFile)

    // Try to get url for download.
    await getDownloadURL(pathReference)

    // Url for download exists (true).
    return true
  } catch (error) {
    // Url does not exists (false).
    return false
  }
}
