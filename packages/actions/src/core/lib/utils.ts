import open from "open"
// import clipboard from "clipboardy" // TODO: need a substitute.
import { Verification } from "@octokit/auth-oauth-device/dist-types/types"
import { OAuthCredential, GithubAuthProvider } from "firebase/auth"

/**
 * @dev TODO: needs refactoring.
 * Custom countdown which throws an error when expires.
 * @param durationInSeconds <number> - the amount of time to be counted expressed in seconds.
 * @param intervalInSeconds <number> - the amount of time that must elapse between updates (default 1s === 1ms).
 */
const createExpirationCountdown = (durationInSeconds: number, intervalInSeconds = 1000) => {
    let seconds = durationInSeconds <= 60 ? durationInSeconds : 60

    setInterval(() => {
        try {
            if (durationInSeconds !== 0) {
                // Update times.
                durationInSeconds -= intervalInSeconds
                seconds -= intervalInSeconds

                if (seconds % 60 === 0) seconds = 0

                process.stdout.write(`Expires in 00:${Math.floor(durationInSeconds / 60)}:${seconds}\r`)
            } else console.log(`Expired`)
        } catch (err: any) {
            // Workaround to the \r.
            process.stdout.write(`\n\n`)
            console.log(`Expired`)
        }
    }, intervalInSeconds * 1000)
}

/**
 * Callback to manage the data requested for Github OAuth2.0 device flow.
 * @param verification <Verification> - the data from Github OAuth2.0 device flow.
 */
export const onVerification = async (verification: Verification): Promise<void> => {
    // Automatically open the page (# Step 2).
    await open(verification.verification_uri)

    // TODO: need a substitute for `clipboardy` package.
    // Copy code to clipboard.
    // clipboard.writeSync(verification.user_code)
    // clipboard.readSync()

    // Display data.
    // TODO. custom theme is missing.
    console.log(
        `Visit ${verification.verification_uri} on this device to authenticate\nYour auth code: ${verification.user_code}`
    )

    // Countdown for time expiration.
    createExpirationCountdown(verification.expires_in, 1)
}

/**
 * Exchange the Github OAuth 2.0 token for a Firebase credential.
 * @param token <string> - the Github OAuth 2.0 token to be exchanged.
 * @returns <OAuthCredential> - the Firebase OAuth credential object.
 */
export const exchangeGithubTokenForFirebaseCredentials = (token: string): OAuthCredential =>
    GithubAuthProvider.credential(token)
