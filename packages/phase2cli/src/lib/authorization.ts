import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device"
import { Verification } from "@octokit/auth-oauth-device/dist-types/types"
import { getCurrentFirebaseAuthUser, signInToFirebaseWithCredentials } from "@zkmpc/actions"
import { FirebaseApp } from "firebase/app"
import { OAuthCredential } from "firebase/auth"
import open from "open"
import clipboard from "clipboardy"
import { AuthUser } from "../../types"
import { theme, emojis, symbols } from "./constants"
import { showError, GENERIC_ERRORS, GITHUB_ERRORS, FIREBASE_ERRORS } from "./errors"
import { checkLocalAccessToken, deleteLocalAccessToken, getLocalAccessToken } from "./localStorage"
import { exchangeGithubTokenForCredentials, getGithubUserHandle } from "./utils"

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
            showError(FIREBASE_ERRORS.FIREBASE_TOKEN_EXPIRED_REMOVED_PERMISSIONS, false)

            // Clean expired access token from local storage.
            deleteLocalAccessToken()

            // Inform user.
            console.log(
                `${symbols.info} We have successfully removed your local token to make you able to repeat the authorization process once again. Please, run the auth command again whenever you are ready and complete the association with the CLI application.`
            )

            // Gracefully exit.
            process.exit(0)
        }

        if (error.toString().includes("Firebase: Error (auth/user-disabled)"))
            showError(FIREBASE_ERRORS.FIREBASE_USER_DISABLED, true)

        if (
            error
                .toString()
                .includes("Firebase: Remote site 5XX from github.com for VERIFY_CREDENTIAL (auth/invalid-credential)")
        )
            showError(FIREBASE_ERRORS.FIREBASE_FAILED_CREDENTIALS_VERIFICATION, true)

        if (error.toString().includes("Firebase: Error (auth/network-request-failed)"))
            showError(FIREBASE_ERRORS.FIREBASE_NETWORK_ERROR, true)

        if (error.toString().includes("HttpError: The authorization request was denied"))
            showError(GITHUB_ERRORS.GITHUB_ACCOUNT_ASSOCIATION_REJECTED, true)

        if (
            error
                .toString()
                .includes(
                    "HttpError: request to https://github.com/login/device/code failed, reason: connect ETIMEDOUT"
                )
        )
            showError(GITHUB_ERRORS.GITHUB_SERVER_TIMEDOUT, true)
    }
}

/**
 * Custom countdown which throws an error when expires.
 * @param expirationInSeconds <number> - the expiration time in seconds.
 */
const expirationCountdownForGithubOAuth = (expirationInSeconds: number) => {
    // Prepare data.
    let secondsCounter = expirationInSeconds <= 60 ? expirationInSeconds : 60
    const interval = 1 // 1s.

    setInterval(() => {
        if (expirationInSeconds !== 0) {
            // Update time and seconds counter.
            expirationInSeconds -= interval
            secondsCounter -= interval

            if (secondsCounter % 60 === 0) secondsCounter = 0

            // Notify user.
            process.stdout.write(
                `${symbols.warning} Expires in ${theme.bold(
                    theme.magenta(`00:${Math.floor(expirationInSeconds / 60)}:${secondsCounter}`)
                )}\r`
            )
        } else {
            process.stdout.write(`\n\n`) // workaround to \r.
            showError(GENERIC_ERRORS.GENERIC_COUNTDOWN_EXPIRATION, true)
        }
    }, interval * 1000) // ms.
}

/**
 * Callback to manage the data requested for Github OAuth2.0 device flow.
 * @param verification <Verification> - the data from Github OAuth2.0 device flow.
 */
export const onVerification = async (verification: Verification): Promise<void> => {
    // Automatically open the page (# Step 2).
    await open(verification.verification_uri)

    // Copy code to clipboard.
    clipboard.writeSync(verification.user_code)
    clipboard.readSync()

    // Display data.
    console.log(
        `${symbols.warning} Visit ${theme.bold(
            theme.underlined(verification.verification_uri)
        )} on this device to authenticate`
    )
    console.log(
        `${symbols.info} Your auth code: ${theme.bold(verification.user_code)} (${emojis.clipboard} ${
            symbols.success
        })\n`
    )

    // Countdown for time expiration.
    expirationCountdownForGithubOAuth(verification.expires_in)
}

/**
 * Return the Github OAuth 2.0 token using manual Device Flow authentication process.
 * @param clientId <string> - the client id for the CLI OAuth app.
 * @returns <string> the Github OAuth 2.0 token.
 */
export const executeGithubDeviceFlow = async (clientId: string): Promise<string> => {
    /**
     * Github OAuth 2.0 Device Flow.
     * # Step 1: Request device and user verification codes and gets auth verification uri.
     * # Step 2: The app prompts the user to enter a user verification code at https://github.com/login/device.
     * # Step 3: The app polls/asks for the user authentication status.
     */

    const clientType = "oauth-app"
    const tokenType = "oauth"

    // # Step 1.
    const auth = createOAuthDeviceAuth({
        clientType,
        clientId,
        scopes: ["gist"],
        onVerification
    })

    // # Step 3.
    const { token } = await auth({
        type: tokenType
    })

    return token
}

/**
 * Ensure that the callee is an authenticated user.
 * @dev This method MUST be executed before each command to avoid authentication errors when interacting with the command.
 * @returns <Promise<AuthUser>> - a custom object containing info about the authenticated user, the token and github handle.
 */
export const checkAuth = async (firebaseApp: FirebaseApp): Promise<AuthUser> => {
    // Check for local token.
    const isLocalTokenStored = checkLocalAccessToken()

    if (!isLocalTokenStored) showError(GITHUB_ERRORS.GITHUB_NOT_AUTHENTICATED, true)

    // Retrieve local access token.
    const token = String(getLocalAccessToken())

    // Get credentials.
    const credentials = exchangeGithubTokenForCredentials(token)

    // Sign in to Firebase using credentials.
    await signInToFirebase(firebaseApp, credentials)

    // Get current authenticated user.
    const user = await getCurrentFirebaseAuthUser(firebaseApp)

    // Get Github handle.
    const githubUserHandle = await getGithubUserHandle(String(token))

    // Greet the user.
    console.log(`Greetings, @${theme.bold(theme.bold(githubUserHandle))} ${emojis.wave}\n`)

    return {
        user,
        token,
        handle: githubUserHandle
    }
}
