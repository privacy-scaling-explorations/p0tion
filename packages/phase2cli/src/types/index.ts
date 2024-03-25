import { User as FirebaseAuthUser } from "firebase/auth"

/**
 * Different custom progress bar types.
 * @enum {string}
 */
export enum ProgressBarType {
    DOWNLOAD = "DOWNLOAD",
    UPLOAD = "UPLOAD"
}

/**
 * Define the current authenticated user in the Firebase app.
 * @typedef {Object} AuthUser
 * @property {FirebaseAuthUser} user - the instance of the Firebase authenticated user.
 * @property {string} token - the access token.
 * @property {string} providerUserId - the unique identifier of the user tied to its account from a third party provider (e.g., Github).
 */
export type AuthUser = {
    user: FirebaseAuthUser
    token: string
    providerUserId: string
}

/**
 * Define a custom object for time management tasks.
 * @typedef {Object} Timing
 * @property {number} seconds
 * @property {number} minutes
 * @property {number} hours
 * @property {number} days
 */
export type Timing = {
    seconds: number
    minutes: number
    hours: number
    days: number
}

/**
 * Define a custom object containing contribution verification data.
 * @typedef {Object} VerifyContributionComputation
 * @property {boolean} valid - true if the contribution is valid; otherwise false.
 * @property {number} verificationComputationTime - the time spent for completing the verification task only.
 * @property {number} verifyCloudFunctionTime - the time spent for the execution of the verify contribution cloud function.
 * @property {number} fullContributionTime - the time spent while contributing (from download to upload).
 */
export type VerifyContributionComputation = {
    valid: boolean
    verificationComputationTime: number
    verifyCloudFunctionTime: number
    fullContributionTime: number
}

/**
 * Define a custom object containing a Github Gist file data.
 * @typedef {Object} GithubGistFile
 * @property {string} filename - the name of the file.
 * @property {string} type - the type of the content of the file (e.g., text/plain).
 * @property {string} language - the type of file (e.g, Text, Markdown).
 * @property {string} raw_url - the url to file content.
 * @property {number} size - the size of the file (in bytes).
 */
export type GithubGistFile = {
    filename: string
    type: string
    language: string
    raw_url: string
    size: number
}

/**
 * Define the return object of the function that verifies the Bandada membership and proof.
 * @typedef {Object} VerifiedBandadaResponse
 * @property {boolean} valid - true if the proof is valid and the user is a member of the group; otherwise false.
 * @property {string} message - a message describing the result of the verification.
 * @property {string} token - the custom access token.
 */
export type VerifiedBandadaResponse = {
    valid: boolean
    message: string
    token: string
}

/**
 * Define the return object of the device code uri request.
 * @typedef {Object} OAuthDeviceCodeResponse
 * @property {string} device_code - the device code.
 * @property {string} user_code - the user code.
 * @property {string} verification_uri - the verification uri.
 * @property {number} expires_in - the expiration time in seconds.
 * @property {number} interval - the interval time in seconds.
 * @property {string} verification_uri_complete - the complete verification uri.
 * @property {string} error - in case there was an error, show the code
 * @property {string} error_description - error details.
 * @property {string} error_uri - error uri.
 */
export type OAuthDeviceCodeResponse = {
    device_code: string
    user_code: string
    verification_uri: string
    expires_in: number
    interval: number
    verification_uri_complete: string
    // error response should contain
    error?: string
    error_description?: string
    error_uri?: string
}

/**
 * Define the return object of the polling endpoint
 * @typedef {Object} OAuthTokenResponse
 * @property {string} access_token - the resulting device flow token
 * @property {string} token_type - token type
 * @property {number} expires_in - when does the token expires
 * @property {string} scope - the scope requested by the initial device flow endpoint
 * @property {string} refresh_token - refresh token
 * @property {string} id_token - id token
 * @property {string} error - in case there was an error, show the code
 * @property {string} error_description - error details
 */
export type OAuthTokenResponse = {
    access_token: string
    token_type: string
    expires_in: number
    scope: string
    refresh_token: string
    id_token: string
    // error response should contain
    error?: string
    error_description?: string
}

/**
 * @typedef {Object} CheckNonceOfSIWEAddressResponse
 * @property {boolean} valid - if the checking was valid or not
 * @property {string} message - more information about the validity
 * @property {string} token - token to sign into Firebase
 */
export type CheckNonceOfSIWEAddressResponse = {
    valid: boolean
    message: string
    token: string
}
