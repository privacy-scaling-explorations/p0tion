import { Verification } from "@octokit/auth-oauth-device/dist-types/types"
import { OAuthCredential, GithubAuthProvider } from "firebase/auth"
import open from "open"
import clipboard from "clipboardy"
import { createExpirationCountdown } from "../../lib/utils.js"

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
