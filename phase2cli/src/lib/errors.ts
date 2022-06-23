import { deleteStoredOAuthToken } from "./auth.js"
import { emojis, symbols } from "./constants.js"

/** Firebase */
const FIREBASE_ERRORS = {
  FIREBASE_DEFAULT_APP_DOUBLE_CONFIG: `Wrong double default configuration for Firebase application`,
  FIREBASE_TOKEN_EXPIRED_REMOVED_PERMISSIONS: `Unsuccessful check authorization response from Github. This usually happens when a token expires or the CLI do not have permissions associated with your Github account`,
  FIREBASE_USER_DISABLED: `Your Github account has been disabled and can no longer be used to contribute. Get in touch with the coordinator to find out more`,
  FIREBASE_FAILED_CREDENTIALS_VERIFICATION: `Firebase cannot verify your Github credentials. This usually happens due to network errors`,
  FIREBASE_NETWORK_ERROR: `Unable to reach Firebase. This usually happens due to network errors`
}

/** Github */
const GITHUB_ERRORS = {
  GITHUB_ACCOUNT_ASSOCIATION_REJECTED: `You refused to associate your Github account with the CLI`,
  GITHUB_SERVER_TIMEDOUT: `Github server has timed out. This usually happens due to network error or Github server downtime`
}

/** Generic */
export const GENERIC_ERRORS = {
  GENERIC_ERROR_RETRIEVING_DATA: `Something went wrong when retrieving the data from the database`,
  GENERIC_COUNTDOWN_EXPIRATION: `Your time to carry out the action has expired`,
  GENERIC_CEREMONY_SELECTION: `You have aborted the ceremony selection process`,
  GENERIC_CIRCUIT_SELECTION: `You have aborted the circuit selection process`,
  GENERIC_DATA_INPUT: `You have aborted the process and do not have provided the requested data`,
  GENERIC_CONTRIBUTION_HASH_INVALID: `You have aborted the process and do not have provided the requested data`
}

/**
 * Print an error string and gracefully terminate the process.
 * @param err <string> - the error string to be shown.
 * @param doExit <boolean> - when true the function terminate the process; otherwise not.
 */
export const showError = (err: string, doExit: boolean) => {
  // Print the error.
  console.error(`${symbols.error} ${err}`)

  // Terminate the process.
  if (doExit) process.exit(0)
}

/**
 * Error handling for auth command.
 * @param err <any> - any error that may happen while running the auth command.
 */
export const handleAuthErrors = (err: any) => {
  const error = err.toString()

  /** Firebase */

  if (error.includes("Firebase: Unsuccessful check authorization response from Github")) {
    showError(FIREBASE_ERRORS.FIREBASE_TOKEN_EXPIRED_REMOVED_PERMISSIONS, false)

    // Clean expired token from local storage.
    deleteStoredOAuthToken()

    console.log(
      `\n ${symbols.success} Removed expired token from storage ${emojis.broom}\n Run \`phase2cli auth\` again to generate a new token and associate your Github account`
    )

    process.exit(1)
  }

  if (error.includes("Firebase: Firebase App named '[DEFAULT]' already exists with different options or config"))
    showError(FIREBASE_ERRORS.FIREBASE_DEFAULT_APP_DOUBLE_CONFIG, true)

  if (error.includes("Firebase: Error (auth/user-disabled)")) showError(FIREBASE_ERRORS.FIREBASE_USER_DISABLED, true)

  if (error.includes("Firebase: Error (auth/network-request-failed)"))
    showError(FIREBASE_ERRORS.FIREBASE_NETWORK_ERROR, true)

  if (error.includes("Firebase: Remote site 5XX from github.com for VERIFY_CREDENTIAL (auth/invalid-credential)"))
    showError(FIREBASE_ERRORS.FIREBASE_FAILED_CREDENTIALS_VERIFICATION, true)

  /** Github */

  if (error.includes("HttpError: The authorization request was denied"))
    showError(GITHUB_ERRORS.GITHUB_ACCOUNT_ASSOCIATION_REJECTED, true)

  if (error.includes("HttpError: request to https://github.com/login/device/code failed, reason: connect ETIMEDOUT"))
    showError(GITHUB_ERRORS.GITHUB_SERVER_TIMEDOUT, true)

  /** Generic */

  showError(`Something went wrong: ${error}`, true)
}
