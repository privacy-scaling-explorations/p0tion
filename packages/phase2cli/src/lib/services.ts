import {
    getCurrentFirebaseAuthUser,
    initializeFirebaseCoreServices,
    signInToFirebaseWithCredentials
} from "@p0tion/actions"
import clear from "clear"
import figlet from "figlet"
import { FirebaseApp } from "firebase/app"
import { OAuthCredential } from "firebase/auth"
import dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname } from "path"
import { AuthUser } from "../types/index.js"
import { CONFIG_ERRORS, CORE_SERVICES_ERRORS, showError, THIRD_PARTY_SERVICES_ERRORS } from "./errors.js"
import { checkLocalAccessToken, deleteLocalAccessToken, getLocalAccessToken } from "./localConfigs.js"
import theme from "./theme.js"
import { exchangeGithubTokenForCredentials, getGithubProviderUserId, getUserHandleFromProviderUserId } from "./utils.js"

const packagePath = `${dirname(fileURLToPath(import.meta.url))}`
dotenv.config({
    path: packagePath.includes(`src/lib`)
        ? `${dirname(fileURLToPath(import.meta.url))}/../../.env`
        : `${dirname(fileURLToPath(import.meta.url))}/.env`
})

/**
 * Bootstrap services and configs is needed for a new command execution and related services.
 * @returns <Promise<FirebaseServices>>
 */
export const bootstrapCommandExecutionAndServices = async (): Promise<any> => {
    // Clean terminal window.
    clear()

    // Print header.
    console.log(theme.colors.magenta(figlet.textSync("Phase 2 cli", { font: "Ogre" })))

    // Check configs.
    if (!process.env.AUTH_GITHUB_CLIENT_ID) showError(CONFIG_ERRORS.CONFIG_GITHUB_ERROR, true)
    if (
        !process.env.FIREBASE_API_KEY ||
        !process.env.FIREBASE_AUTH_DOMAIN ||
        !process.env.FIREBASE_PROJECT_ID ||
        !process.env.FIREBASE_MESSAGING_SENDER_ID ||
        !process.env.FIREBASE_APP_ID ||
        !process.env.FIREBASE_CF_URL_VERIFY_CONTRIBUTION
    )
        showError(CONFIG_ERRORS.CONFIG_FIREBASE_ERROR, true)
    if (
        !process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB ||
        !process.env.CONFIG_CEREMONY_BUCKET_POSTFIX ||
        !process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS
    )
        showError(CONFIG_ERRORS.CONFIG_OTHER_ERROR, true)

    // Initialize and return Firebase services instances (App, Firestore, Functions)
    return initializeFirebaseCoreServices(
        String(process.env.FIREBASE_API_KEY),
        String(process.env.FIREBASE_AUTH_DOMAIN),
        String(process.env.FIREBASE_PROJECT_ID),
        String(process.env.FIREBASE_MESSAGING_SENDER_ID),
        String(process.env.FIREBASE_APP_ID)
    )
}

/**
 * Execute the sign in to Firebase using OAuth credentials.
 * @dev wrapper method to handle custom errors.
 * @param firebaseApp <FirebaseApp> - the configured instance of the Firebase App in use.
 * @param credentials <OAuthCredential> - the OAuth credential generated from token exchange.
 * @returns <Promise<void>>
 */
export const signInToFirebase = async (firebaseApp: FirebaseApp, credentials: OAuthCredential): Promise<void> => {
    try {
        // Sign in with credentials to Firebase.
        await signInToFirebaseWithCredentials(firebaseApp, credentials)
    } catch (error: any) {
        // Error handling by parsing error message.
        if (error.toString().includes("Firebase: Unsuccessful check authorization response from Github")) {
            showError(CORE_SERVICES_ERRORS.FIREBASE_TOKEN_EXPIRED_REMOVED_PERMISSIONS, false)

            // Clean expired access token from local storage.
            deleteLocalAccessToken()

            // Inform user.
            console.log(
                `${theme.symbols.info} We have successfully removed your local token to make you able to repeat the authorization process once again. Please, run the auth command again whenever you are ready and complete the association with the CLI application.`
            )

            // Gracefully exit.
            process.exit(0)
        }

        if (error.toString().includes("Firebase: Error (auth/user-disabled)"))
            showError(CORE_SERVICES_ERRORS.FIREBASE_USER_DISABLED, true)

        if (
            error
                .toString()
                .includes("Firebase: Remote site 5XX from github.com for VERIFY_CREDENTIAL (auth/invalid-credential)")
        )
            showError(CORE_SERVICES_ERRORS.FIREBASE_FAILED_CREDENTIALS_VERIFICATION, true)

        if (error.toString().includes("Firebase: Error (auth/network-request-failed)"))
            showError(CORE_SERVICES_ERRORS.FIREBASE_NETWORK_ERROR, true)

        if (error.toString().includes("HttpError: The authorization request was denied"))
            showError(THIRD_PARTY_SERVICES_ERRORS.GITHUB_ACCOUNT_ASSOCIATION_REJECTED, true)

        if (
            error
                .toString()
                .includes(
                    "HttpError: request to https://github.com/login/device/code failed, reason: connect ETIMEDOUT"
                )
        )
            showError(THIRD_PARTY_SERVICES_ERRORS.GITHUB_SERVER_TIMEDOUT, true)
    }
}



/**
 * Ensure that the callee is an authenticated user.
 * @notice The token will be passed as parameter.
 * @dev This method can be used within GitHub actions or other CI/CD pipelines.
 * @param firebaseApp <FirebaseApp> - the configured instance of the Firebase App in use.
 * @param token <string> - the token to be used for authentication.
 * @returns <Promise<AuthUser>> - a custom object containing info about the authenticated user, the token and github handle.
 */
export const authWithToken = async (firebaseApp: FirebaseApp, token: string): Promise<AuthUser> => {
    // Get credentials.
    const credentials = exchangeGithubTokenForCredentials(token)

    // Sign in to Firebase using credentials.
    await signInToFirebase(firebaseApp, credentials)

    // Get current authenticated user.
    const user = getCurrentFirebaseAuthUser(firebaseApp)

    // Get Github unique identifier (handle-id).
    const providerUserId = await getGithubProviderUserId(String(token))

    // Greet the user.
    console.log(
        `Greetings, @${theme.text.bold(getUserHandleFromProviderUserId(providerUserId))} ${theme.emojis.wave}\n`
    )

    return {
        user,
        token,
        providerUserId
    }
}

/**
 * Ensure that the callee is an authenticated user.
 * @dev This method MUST be executed before each command to avoid authentication errors when interacting with the command.
 * @returns <Promise<AuthUser>> - a custom object containing info about the authenticated user, the token and github handle.
 */
export const checkAuth = async (firebaseApp: FirebaseApp): Promise<AuthUser> => {
    // Check for local token.
    const isLocalTokenStored = checkLocalAccessToken()

    if (!isLocalTokenStored) showError(THIRD_PARTY_SERVICES_ERRORS.GITHUB_NOT_AUTHENTICATED, true)

    // Retrieve local access token.
    const token = String(getLocalAccessToken())

    // Get credentials.
    const credentials = exchangeGithubTokenForCredentials(token)

    // Sign in to Firebase using credentials.
    await signInToFirebase(firebaseApp, credentials)

    // Get current authenticated user.
    const user = getCurrentFirebaseAuthUser(firebaseApp)

    // Get Github unique identifier (handle-id).
    const providerUserId = await getGithubProviderUserId(String(token))

    // Greet the user.
    console.log(
        `Greetings, @${theme.text.bold(getUserHandleFromProviderUserId(providerUserId))} ${theme.emojis.wave}\n`
    )

    return {
        user,
        token,
        providerUserId
    }
}
