import * as functions from "firebase-functions"
import admin from "firebase-admin"

admin.initializeApp()

/**
 * Simple HTTP function that returns the "?text" query parameter in the response text.
 */
export const simpleHttp = functions.https.onRequest((request, response) => {
  response.send(`text: ${request.query.text}`)
})

/**
 * Simple callable function that adds two numbers.
 */
export const simpleCallable = functions.https.onCall((data) => {
  // This function implements addition (a + b = c)
  const sum = data.a + data.b
  return {
    c: sum
  }
})

/**
 * Firestore-triggered function which uppercases a string field of a document.
 */
export const firestoreUppercase = functions.firestore.document("/lowercase/{doc}").onCreate(async (doc) => {
  const docId = doc.id

  const docData = doc.data()
  const lowercase = docData.text

  const firestore = admin.firestore()
  await firestore.collection("uppercase").doc(docId).set({
    text: lowercase.toUpperCase()
  })
})

/**
 * Auth-triggered function which writes a user document to Firestore.
 */
export const userSaver = functions.auth.user().onCreate(async (user) => {
  const firestore = admin.firestore()

  // Make a document in the user's collection with everything we know about the user
  const userId = user.uid
  const userRef = firestore.collection("users").doc(userId)
  await userRef.set(user.toJSON())
})

/**
 * Simple scheduled console.log function.
 */
export const scheduledFunction = functions.pubsub.schedule("every 2 minutes").onRun(() => {
  console.log("This will be run every 2 minutes!")
  return null
})
