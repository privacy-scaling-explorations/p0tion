import Conf from "conf"
import { FirebaseApp } from "firebase/app"
import { signInToFirebaseWithGithubToken, getCurrentFirebaseAuthUser } from "@zkmpc/actions"
import { IdTokenResult, User } from "firebase/auth"
import { AuthUser } from "../../types/index"
import { readLocalJsonFile } from "./files"
import { GENERIC_ERRORS, GITHUB_ERRORS, showError } from "./errors"
import { emojis, theme } from "./constants"
import { getGithubUsername } from "./utils"

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
export const handleCurrentAuthUserSignIn = async (firebaseApp: FirebaseApp): Promise<AuthUser> => {
    // Get/Set OAuth Token.
    const token = await checkForStoredOAuthToken()

    // Sign in.
    // TODO: maybe this is not correct for #171.
    await signInToFirebaseWithGithubToken(firebaseApp, token)

    // Get current authenticated user.
    const user = await getCurrentFirebaseAuthUser(firebaseApp)

    // Get the username of the authenticated user.
    const username = await getGithubUsername(token)

    // Greet the user.
    console.log(`Greetings, @${theme.bold(theme.bold(username))} ${emojis.wave}\n`)

    return {
        user,
        token,
        username
    }
}
