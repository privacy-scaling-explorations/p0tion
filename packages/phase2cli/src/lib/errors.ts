import { symbols } from "./constants"

/** Firebase */
export const FIREBASE_ERRORS = {
    FIREBASE_NOT_CONFIGURED_PROPERLY: `Check that all FIREBASE environment variables are configured properly`,
    FIREBASE_DEFAULT_APP_DOUBLE_CONFIG: `Wrong double default configuration for Firebase application`,
    FIREBASE_TOKEN_EXPIRED_REMOVED_PERMISSIONS: `Unsuccessful check authorization response from Github. This usually happens when a token expires or the CLI do not have permissions associated with your Github account`,
    FIREBASE_USER_DISABLED: `Your Github account has been disabled and can no longer be used to contribute. Get in touch with the coordinator to find out more`,
    FIREBASE_FAILED_CREDENTIALS_VERIFICATION: `Firebase cannot verify your Github credentials. This usually happens due to network errors`,
    FIREBASE_NETWORK_ERROR: `Unable to reach Firebase. This usually happens due to network errors`,
    FIREBASE_CEREMONY_NOT_OPENED: `There are no ceremonies opened to contributions`,
    FIREBASE_CEREMONY_NOT_CLOSED: `There are no ceremonies ready to finalization`
}

/** Github */
export const GITHUB_ERRORS = {
    GITHUB_NOT_CONFIGURED_PROPERLY: `Github \`CLIENT_ID\` environment variable is not configured properly`,
    GITHUB_ACCOUNT_ASSOCIATION_REJECTED: `You refused to associate your Github account with the CLI`,
    GITHUB_SERVER_TIMEDOUT: `Github server has timed out. This usually happens due to network error or Github server downtime`,
    GITHUB_GET_USERNAME_FAILED: `Something went wrong while retrieving your Github username`,
    GITHUB_NOT_AUTHENTICATED: `You are not authenticated. Please, run \`phase2cli auth\` command first`,
    GITHUB_GIST_PUBLICATION_FAILED: `Something went wrong while publishing a Gist from your Github account`
}

/** Generic */
export const GENERIC_ERRORS = {
    GENERIC_NOT_CONFIGURED_PROPERLY: `Check that all CONFIG environment variables are configured properly`,
    GENERIC_ERROR_RETRIEVING_DATA: `Something went wrong when retrieving the data from the database`,
    GENERIC_FILE_ERROR: `File not found`,
    GENERIC_NOT_COORDINATOR: `You are not a coordinator for the ceremony`,
    GENERIC_COUNTDOWN_EXPIRED: `The amount of time for completing the operation has expired`,
    GENERIC_R1CS_MISSING_INFO: `The necessary information was not found in the given R1CS file`,
    GENERIC_COUNTDOWN_EXPIRATION: `Your time to carry out the action has expired`,
    GENERIC_CEREMONY_SELECTION: `You have aborted the ceremony selection process`,
    GENERIC_CIRCUIT_SELECTION: `You have aborted the circuit selection process`,
    GENERIC_DATA_INPUT: `You have aborted the process without providing any of the requested data`,
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
