import * as functions from "firebase-functions"
import admin from "firebase-admin"
import { UserRecord } from "firebase-functions/v1/auth"

admin.initializeApp()

/**
 * Auth-triggered function which writes a user document to Firestore.
 */
export default functions.auth.user().onCreate(async (user: UserRecord) => {
  // Get DB.
  const firestore = admin.firestore()

  // Get user information.
  if (!user.uid) throw new Error("Oops, no authenticated user!")

  // The user object has basic properties such as display name, email, etc.
  const { displayName } = user
  const { email } = user
  const { photoURL } = user
  const { emailVerified } = user

  // Metadata.
  const { creationTime } = user.metadata
  const { lastSignInTime } = user.metadata

  // The user's ID, unique to the Firebase project. Do NOT use
  // this value to authenticate with your backend server, if
  // you have one. Use User.getToken() instead.
  const { uid } = user

  // Reference to a document using uid.
  const userRef = firestore.collection("users").doc(uid)

  // Set document (nb. we refer to providerData[0] because we use Github OAuth provider only).
  await userRef.set({
    name: displayName,
    // username: user.username, // TODO: get username.
    // Metadata.
    creationTime,
    lastSignInTime,
    // Optional.
    email: email || "",
    emailVerified: emailVerified || false,
    photoURL: photoURL || ""
  })
})
