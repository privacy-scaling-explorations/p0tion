import * as functions from "firebase-functions"
import { UserRecord } from "firebase-functions/v1/auth"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { GENERIC_ERRORS, logMsg } from "../lib/logs"
import { getCurrentServerTimestampInMillis } from "../lib/utils"
import { MsgType } from "../../types/enums"

dotenv.config()

/**
 * Auth-triggered function which writes a user document to Firestore.
 */
export const registerAuthUser = functions.auth.user().onCreate(async (user: UserRecord) => {
    // Get DB.
    const firestore = admin.firestore()

    // Get user information.
    if (!user.uid) logMsg(GENERIC_ERRORS.GENERR_NO_AUTH_USER_FOUND, MsgType.ERROR)

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
        displayName,
        // Metadata.
        creationTime,
        lastSignInTime,
        // Optional.
        email: email || "",
        emailVerified: emailVerified || false,
        photoURL: photoURL || "",
        lastUpdated: getCurrentServerTimestampInMillis()
    })

    logMsg(`User ${uid} correctly stored`, MsgType.INFO)
})

/**
 * Set custom claims for role-based access control on the newly created user.
 */
export const processSignUpWithCustomClaims = functions.auth.user().onCreate(async (user: UserRecord) => {
    // Get user information.
    if (!user.uid) logMsg(GENERIC_ERRORS.GENERR_NO_AUTH_USER_FOUND, MsgType.ERROR)

    let customClaims: any
    // Check if user meets role criteria to be a coordinator.
    if (
        user.email &&
        (user.email.endsWith(`@${process.env.CUSTOM_CLAIMS_COORDINATOR_EMAIL_ADDRESS_OR_DOMAIN}`) ||
            user.email === process.env.CUSTOM_CLAIMS_COORDINATOR_EMAIL_ADDRESS_OR_DOMAIN)
    ) {
        customClaims = { coordinator: true }

        logMsg(`User ${user.uid} identified as coordinator`, MsgType.INFO)
    } else {
        customClaims = { participant: true }

        logMsg(`User ${user.uid} identified as participant`, MsgType.INFO)
    }

    try {
        // Set custom user claims on this newly created user.
        await admin.auth().setCustomUserClaims(user.uid, customClaims)
    } catch (error: any) {
        logMsg(`Something went wrong: ${error.toString()}`, MsgType.ERROR)
    }
})
