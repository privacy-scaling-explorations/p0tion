import { Verification } from "@octokit/auth-oauth-device/dist-types/types"
import { OAuthCredential } from "firebase/auth"
/**
 * Callback to manage the data requested for Github OAuth2.0 device flow.
 * @param verification <Verification> - the data from Github OAuth2.0 device flow.
 */
export declare const onVerification: (verification: Verification) => Promise<void>
/**
 * Exchange the Github OAuth 2.0 token for a Firebase credential.
 * @param token <string> - the Github OAuth 2.0 token to be exchanged.
 * @returns <OAuthCredential> - the Firebase OAuth credential object.
 */
export declare const exchangeGithubTokenForFirebaseCredentials: (token: string) => OAuthCredential
