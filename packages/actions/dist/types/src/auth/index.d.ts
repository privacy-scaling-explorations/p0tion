import { FirebaseApp } from "firebase/app"
/**
 * Return the Github OAuth 2.0 token using manual Device Flow authentication process.
 * @param clientId <string> - the client id for the CLI OAuth app.
 * @returns <string> the Github OAuth 2.0 token.
 */
export declare const getNewOAuthTokenUsingGithubDeviceFlow: (clientId: string) => Promise<string>
/**
 * Sign in w/ OAuth 2.0 token.
 * @param firebaseApp <FirebaseApp> - the configured instance of the Firebase App in use.
 * @param token <string> - the Github OAuth 2.0 token to be exchanged.
 */
export declare const signInToFirebaseWithGithubToken: (firebaseApp: FirebaseApp, token: string) => Promise<void>
export declare const authActions: {
  getNewOAuthTokenUsingGithubDeviceFlow: (clientId: string) => Promise<string>
  signInToFirebaseWithGithubToken: (firebaseApp: FirebaseApp, token: string) => Promise<void>
}
