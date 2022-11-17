import { OAuthCredential } from "firebase/auth"
import { GithubOAuthRequest } from "../../types"
/**
 * Exchange the Github OAuth 2.0 token for a Firebase credential.
 * @param token <string> - the Github OAuth 2.0 token to be exchanged.
 * @returns <OAuthCredential> - the Firebase OAuth credential object.
 */
export declare const exchangeTokenForCredentials: (token: string) => OAuthCredential
/**
 * Sign in w/ OAuth 2.0 token.
 * @param token <string> - the Github OAuth 2.0 token to be exchanged.
 */
export declare const signIn: (token: string) => Promise<void>
/**
 * Make a new countdown and throws an error when time is up.
 * @param durationInSeconds <number> - the amount of time to be counted in seconds.
 * @param intervalInSeconds <number> - update interval in seconds.
 */
export declare const createExpirationCountdown: (durationInSeconds: number, intervalInSeconds: number) => void
/**
 * Manage the data requested for Github OAuth2.0.
 * @param data <GithubOAuthRequest> - the data from Github OAuth2.0 device flow request.
 */
export declare const onVerification: (data: GithubOAuthRequest) => Promise<void>
/**
 * Return the Github OAuth 2.0 token using manual Device Flow authentication process.
 * @param clientId <string> - the client id for the CLI OAuth app.
 * @returns <string> the Github OAuth 2.0 token.
 */
export declare const getOAuthToken: (clientId: string) => Promise<string>
/**
 * Look for the Github 2.0 OAuth token in the local storage if present; otherwise manage the request for a new token.
 * @returns <Promise<string>>
 */
export declare const handleGithubToken: (ghClientId: string) => Promise<string>
/**
 * Get the Github username for the logged in user.
 * @param token <string> - the Github OAuth 2.0 token.
 * @returns <Promise<string>> - the user Github username.
 */
export declare const getGithubUsername: (token: string) => Promise<string>
