import * as functions from "firebase-functions"
import { UserRecord } from "firebase-functions/v1/auth"
import { CallableRequest, onCall } from "firebase-functions/v2/https"
import { setGlobalOptions } from "firebase-functions/v2"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { commonTerms, githubReputation, SiweAuthCallData } from "@p0tion/actions"
import { encode } from "html-entities"
import { SiweMessage } from "siwe"
import { getGitHubVariables, getCurrentServerTimestampInMillis } from "../lib/utils"
import { logAndThrowError, makeError, printLog, SPECIFIC_ERRORS } from "../lib/errors"
import { LogLevel } from "../types/enums"

dotenv.config()

setGlobalOptions({ 
    region: "europe-west1",
    memory: "512MiB" }); // only for v2 funcs

/**
 * Record the authenticated user information inside the Firestore DB upon authentication.
 * @dev the data is recorded in a new document in the `users` collection.
 * @notice this method is automatically triggered upon user authentication in the Firebase app
 * which uses the Firebase Authentication service.
 */
export const registerAuthUser = functions
    .region("europe-west1")
    .runWith({
        memory: "512MB"
    })
    .auth.user()
    .onCreate(async (user: UserRecord) => {
        // Get DB.
        const firestore = admin.firestore()
        // Get user information.
        if (!user.uid) logAndThrowError(SPECIFIC_ERRORS.SE_AUTH_NO_CURRENT_AUTH_USER)
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
        const userRef = firestore.collection(commonTerms.collections.users.name).doc(uid)
        // html encode the display name (or put the ID if the name is not displayed)
        const encodedDisplayName =
            user.displayName === "Null" || user.displayName === null ? user.uid : encode(displayName)

        // store the avatar URL of a contributor
        let avatarUrl: string = ""
        // we only do reputation check if the user is not a coordinator
        if (
            !(
                email?.endsWith(`@${process.env.CUSTOM_CLAIMS_COORDINATOR_EMAIL_ADDRESS_OR_DOMAIN}`) ||
                email === process.env.CUSTOM_CLAIMS_COORDINATOR_EMAIL_ADDRESS_OR_DOMAIN
            )
        ) {
            const auth = admin.auth()
            // if provider == github.com let's use our functions to check the user's reputation
            if (user.providerData.length > 0 && user.providerData[0].providerId === "github.com") {
                const vars = getGitHubVariables()

                // this return true or false
                try {
                    const { reputable, avatarUrl: avatarURL } = await githubReputation(
                        user.providerData[0].uid,
                        vars.minimumFollowing,
                        vars.minimumFollowers,
                        vars.minimumPublicRepos,
                        vars.minimumAge
                    )
                    if (!reputable) {
                        // Delete user
                        await auth.deleteUser(user.uid)
                        // Throw error
                        logAndThrowError(
                            makeError(
                                "permission-denied",
                                "The user is not allowed to sign up because their Github reputation is not high enough.",
                                `The user ${
                                    user.displayName === "Null" || user.displayName === null
                                        ? user.uid
                                        : user.displayName
                                } is not allowed to sign up because their Github reputation is not high enough. Please contact the administrator if you think this is a mistake.`
                            )
                        )
                    }
                    // store locally
                    avatarUrl = avatarURL
                    printLog(
                        `Github reputation check passed for user ${
                            user.displayName === "Null" || user.displayName === null ? user.uid : user.displayName
                        }`,
                        LogLevel.DEBUG
                    )
                } catch (error: any) {
                    // Delete user
                    await auth.deleteUser(user.uid)
                    logAndThrowError(
                        makeError(
                            "permission-denied",
                            "There was an error while checking the user's Github reputation.",
                            `${error}`
                        )
                    )
                }
            }
        }
        // Set document (nb. we refer to providerData[0] because we use Github OAuth provider only).
        // In future releases we might want to loop through the providerData array as we support
        // more providers.
        await userRef.set({
            name: encodedDisplayName,
            encodedDisplayName,
            // Metadata.
            creationTime,
            lastSignInTime: lastSignInTime || creationTime,
            // Optional.
            email: email || "",
            emailVerified: emailVerified || false,
            photoURL: photoURL || "",
            lastUpdated: getCurrentServerTimestampInMillis()
        })

        // we want to create a new collection for the users to store the avatars
        const avatarRef = firestore.collection(commonTerms.collections.avatars.name).doc(uid)
        await avatarRef.set({
            avatarUrl: avatarUrl || ""
        })
        printLog(`Authenticated user document with identifier ${uid} has been correctly stored`, LogLevel.DEBUG)
        printLog(`Authenticated user avatar with identifier ${uid} has been correctly stored`, LogLevel.DEBUG)
    })
/**
 * Set custom claims for role-based access control on the newly created user.
 * @notice this method is automatically triggered upon user authentication in the Firebase app
 * which uses the Firebase Authentication service.
 */
export const processSignUpWithCustomClaims = functions
    .region("europe-west1")
    .runWith({
        memory: "512MB"
    })
    .auth.user()
    .onCreate(async (user: UserRecord) => {
        // Get user information.
        if (!user.uid) logAndThrowError(SPECIFIC_ERRORS.SE_AUTH_NO_CURRENT_AUTH_USER)
        // Prepare state.
        let customClaims: any
        // Check if user meets role criteria to be a coordinator.
        if (
            user.email &&
            (user.email.endsWith(`@${process.env.CUSTOM_CLAIMS_COORDINATOR_EMAIL_ADDRESS_OR_DOMAIN}`) ||
                user.email === process.env.CUSTOM_CLAIMS_COORDINATOR_EMAIL_ADDRESS_OR_DOMAIN)
        ) {
            customClaims = { coordinator: true }
            printLog(`Authenticated user ${user.uid} has been identified as coordinator`, LogLevel.DEBUG)
        } else {
            customClaims = { participant: true }
            printLog(`Authenticated user ${user.uid} has been identified as participant`, LogLevel.DEBUG)
        }
        try {
            // Set custom user claims on this newly created user.
            await admin.auth().setCustomUserClaims(user.uid, customClaims)
        } catch (error: any) {
            const specificError = SPECIFIC_ERRORS.SE_AUTH_SET_CUSTOM_USER_CLAIMS_FAIL
            const additionalDetails = error.toString()
            logAndThrowError(makeError(specificError.code, specificError.message, additionalDetails))
        }
    })


/**
 * Sign-in with Ethereum. 
 * @notice this function is called to verify authorisation of an Ethereum account. 
 * Verifies the account using a signature, then performs further required checks.
 * For a verified address, a custom token will be returned, otherwise an empty array.
 */
export const siweAuth = onCall(
    async (request: CallableRequest<SiweAuthCallData>) : Promise<Array<string>> => {
        const { message, signature } = request.data
        const { address } = message
        const siweMessage = new SiweMessage(message)
        console.log(`message: ${JSON.stringify(siweMessage)}`)
        return new Promise( (resolve, reject) => {
            try {
                siweMessage.verify({ signature }).then(() => {
                    // TODO - check for minimum nonce
                    admin.auth().createCustomToken(address).then((token: string) => {
                        resolve( [
                            token
                        ])
                    })
                })
            } catch (err: any) {
                console.log(`Error getting custom token: ${err.message}`)
                reject(err.message)
            }
        })
    })
