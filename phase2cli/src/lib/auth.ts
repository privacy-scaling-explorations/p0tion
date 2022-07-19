import Conf from "conf"
import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device"
// import open from "open"
import clipboard from "clipboardy"
import {
  getAuth,
  GithubAuthProvider,
  IdTokenResult,
  OAuthCredential,
  signInWithCredential,
  signOut,
  User
} from "firebase/auth"
import open from "open"
import { AuthUser, GithubOAuthRequest } from "../../types/index.js"
import { emojis, symbols, theme } from "./constants.js"
import { readLocalJsonFile } from "./files.js"
import { createExpirationCountdown, getGithubUsername } from "./utils.js"
import { GENERIC_ERRORS, GITHUB_ERRORS, showError } from "./errors.js"

// Get local configs.
const { name } = readLocalJsonFile("../../package.json")

// Local configstore for storing auth data (e.g., tokens).
const config = new Conf({
  projectName: name,
  schema: {
    authToken: {
      type: "string",
      default: ""
    }
  }
})

/**
 * Manage the data requested for Github OAuth2.0.
 * @param data <GithubOAuthRequest> - the data from Github OAuth2.0 device flow request.
 */
const onVerification = async (data: GithubOAuthRequest): Promise<void> => {
  // Automatically open the page (# Step 2).
  await open(data.verification_uri)

  // Copy code to clipboard.
  clipboard.writeSync(data.user_code)
  clipboard.readSync()

  // Display data.
  console.log(
    `${symbols.warning} Visit ${theme.bold(theme.underlined(data.verification_uri))} on this device to authenticate`
  )
  console.log(
    `${symbols.info} Your auth code: ${theme.bold(data.user_code)} (${emojis.clipboard} ${symbols.success})\n`
  )

  // Countdown for time expiration.
  createExpirationCountdown(data.expires_in, 1)
}

/**
 * Exchange the Github OAuth 2.0 token for a Firebase credential.
 * @param token <string> - the Github OAuth 2.0 token to be exchanged.
 * @returns <OAuthCredential> - the Firebase OAuth credential object.
 */
const exchangeTokenForCredentials = (token: string): OAuthCredential => GithubAuthProvider.credential(token)

/**
 * Return the Github OAuth 2.0 token, if present.
 * @returns <string | undefined> - the Github OAuth 2.0 token if present, otherwise undefined.
 */
export const getStoredOAuthToken = (): string | unknown => config.get("authToken")

/**
 * Check if the Github OAuth 2.0 token exists in the local config store.
 * @returns <boolean>
 */
export const hasStoredOAuthToken = (): boolean => config.has("authToken") && !!config.get("authToken")

/**
 * Store the Github OAuth 2.0 token.
 * @param token <string> - the Github OAuth 2.0 token to be stored.
 */
export const setStoredOAuthToken = (token: string) => config.set("authToken", token)

/**
 * Delete the stored Github OAuth 2.0 token.
 */
export const deleteStoredOAuthToken = () => config.delete("authToken")

/**
 * Return the Github OAuth 2.0 token stored locally.
 * @returns <Promise<string>> - the Github OAuth 2.0 token.
 */
export const checkForStoredOAuthToken = async (): Promise<string> => {
  if (!hasStoredOAuthToken()) showError(GITHUB_ERRORS.GITHUB_NOT_AUTHENTICATED, true)

  return String(getStoredOAuthToken())
}

/**
 * Return the Github OAuth 2.0 token using manual Device Flow authentication process.
 * @param clientId <string> - the client id for the CLI OAuth app.
 * @returns <string> the Github OAuth 2.0 token.
 */
export const getOAuthToken = async (clientId: string): Promise<string> => {
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
 * @param token <string> - the Github OAuth 2.0 token to be exchanged.
 */
export const signIn = async (token: string) => {
  // Sign in with the credential.
  await signInWithCredential(getAuth(), exchangeTokenForCredentials(token))
}

/**
 * Return the current authenticated user.
 * @returns <User> - the current authenticated user.
 */
export const getCurrentAuthUser = (): User => {
  const user = getAuth().currentUser

  if (!user) showError(GITHUB_ERRORS.GITHUB_NOT_AUTHENTICATED, true)

  return user!
}

/**
 * Sign out the current authenticated user.
 */
export const logout = async (): Promise<void> => {
  const auth = getAuth()

  await signOut(auth)
}

/**
 * Return the JWT token and helpers (claims) related to the current authenticated user.
 * @param user <User> - the current authenticated user.
 * @returns <Promise<IdTokenResult>>
 */
const getTokenAndClaims = async (user: User): Promise<IdTokenResult> => {
  // Force refresh to update custom claims.
  await user.getIdToken(true)

  return user.getIdTokenResult()
}

/**
 * Throw an error if the user does not have a coordinator role.
 * @param user <User> - the current authenticated user.
 */
export const onlyCoordinator = async (user: User) => {
  const userTokenAndClaims = await getTokenAndClaims(user)

  if (!userTokenAndClaims.claims.coordinator) showError(GENERIC_ERRORS.GENERIC_NOT_COORDINATOR, true)
}

/**
 * Checks whether the user has correctly completed the `auth` command and returns his/her data.
 * @returns <Promise<AuthUser>>
 */
export const handleAuthUserSignIn = async (): Promise<AuthUser> => {
  // Get/Set OAuth Token.
  const ghToken = await checkForStoredOAuthToken()

  // Sign in.
  await signIn(ghToken)

  // Get current authenticated user.
  const user = getCurrentAuthUser()

  // Get user Github username.
  const ghUsername = await getGithubUsername(ghToken)

  console.log(`Greetings, @${theme.bold(theme.bold(ghUsername))} ${emojis.wave}\n`)

  return {
    user,
    ghToken,
    ghUsername
  }
}
