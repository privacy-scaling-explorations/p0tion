import { FirebaseApp } from "firebase/app"
import { getAuth, signInWithCredential } from "firebase/auth"
import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device"
import { exchangeGithubTokenForFirebaseCredentials, onVerification } from "./lib/index.js"

/**
 * Return the Github OAuth 2.0 token using manual Device Flow authentication process.
 * @param clientId <string> - the client id for the CLI OAuth app.
 * @returns <string> the Github OAuth 2.0 token.
 */
export const getNewOAuthTokenUsingGithubDeviceFlow = async (clientId: string): Promise<string> => {
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
 * Sign in w/ OAuth 2.0 token.
 * @param firebaseApp <FirebaseApp> - the configured instance of the Firebase App in use.
 * @param token <string> - the Github OAuth 2.0 token to be exchanged.
 */
export const signInToFirebaseWithGithubToken = async (firebaseApp: FirebaseApp, token: string) => {
  // Sign in with the credential.
  await signInWithCredential(getAuth(), exchangeGithubTokenForFirebaseCredentials(token))
}

export const authActions = {
  getNewOAuthTokenUsingGithubDeviceFlow,
  signInToFirebaseWithGithubToken
}
