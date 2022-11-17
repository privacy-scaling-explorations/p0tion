/**
 * Check if the Github OAuth 2.0 token exists in the local config store.
 * @returns <boolean>
 */
export declare const hasStoredOAuthToken: () => boolean
/**
 * Return the Github OAuth 2.0 token, if present.
 * @returns <string | undefined> - the Github OAuth 2.0 token if present, otherwise undefined.
 */
export declare const getStoredOAuthToken: () => string | unknown
/**
 * Store the Github OAuth 2.0 token.
 * @param token <string> - the Github OAuth 2.0 token to be stored.
 */
export declare const setStoredOAuthToken: (token: string) => void
