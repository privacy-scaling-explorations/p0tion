import Conf from "conf"
import { FirebaseApp } from "firebase/app"
import { authActions } from "@zkmpc/actions"
import { getAuth, IdTokenResult, User } from "firebase/auth"
import { AuthUser } from "../../types/index.js"
import { emojis, theme } from "./constants.js"
import { readLocalJsonFile } from "./files.js"
import { getGithubUsername } from "./utils.js"
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
 * Return the current authenticated user.
 * @returns <User> - the current authenticated user.
 */
export const getCurrentAuthUser = (): User => {
  const user = getAuth().currentUser

  if (!user) showError(GITHUB_ERRORS.GITHUB_NOT_AUTHENTICATED, true)

  return user!
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
export const handleAuthUserSignIn = async (firebaseApp: FirebaseApp): Promise<AuthUser> => {
  // Get/Set OAuth Token.
  const ghToken = await checkForStoredOAuthToken()

  // TODO: to be checked.
  // Sign in.
  await authActions.signInToFirebaseWithGithubToken(firebaseApp, ghToken)

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
