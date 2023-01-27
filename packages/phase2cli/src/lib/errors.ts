import { symbols } from "./constants"

/** Firebase */
export const FIREBASE_ERRORS = {
    FIREBASE_DEFAULT_APP_DOUBLE_CONFIG: `Wrong double default configuration for Firebase application`,
    FIREBASE_TOKEN_EXPIRED_REMOVED_PERMISSIONS: `The Github authorization has failed due to lack of association between your account and the CLI`,
    FIREBASE_USER_DISABLED: `The Github account has been suspended by the ceremony coordinator(s), blocking the possibility of contribution. Please, contact them to understand the motivation behind it.`,
    FIREBASE_FAILED_CREDENTIALS_VERIFICATION: `Firebase cannot verify your Github credentials due to network errors. Please, try once again later.`,
    FIREBASE_NETWORK_ERROR: `Unable to reach Firebase due to network erros. Please, try once again later and make sure your Internet connection is stable.`,
    FIREBASE_CEREMONY_NOT_OPENED: `There are no ceremonies opened to contributions`,
    FIREBASE_CEREMONY_NOT_CLOSED: `There are no ceremonies ready to finalization`
}

/** Github */
export const GITHUB_ERRORS = {
    GITHUB_ACCOUNT_ASSOCIATION_REJECTED: `You have decided not to associate the CLI application with your Github account. This declination will not allow you to make a contribution to any ceremony. In case you made a mistake, you can always repeat the process and accept the association of your Github account with the CLI.`,
    GITHUB_SERVER_TIMEDOUT: `Github's servers are experiencing downtime. Please, try once again later and make sure your Internet connection is stable.`,
    GITHUB_GET_HANDLE_FAILED: `Something went wrong while retrieving your Github handle. Please, try once again later`,
    GITHUB_NOT_AUTHENTICATED: `You are unable to execute the command since you have not authorized this device with your Github account. Please, execute the auth command (\`phase2cli auth\`) and then re-run this command.`,
    GITHUB_GIST_PUBLICATION_FAILED: `Something went wrong while publishing a Gist from your Github account`
}

/** Command */
export const COMMAND_ERRORS = {
    COMMAND_NOT_COORDINATOR: `Unable to execute the command. In order to perform coordinator functionality you must authenticate with an account having adeguate permissions.`,
    COMMAND_ABORT_PROMPT: `The data submission process was suddenly interrupted. Your previous data has not been saved. We are sorry, you will have to repeat the process again from the beginning.`,
    COMMAND_ABORT_SELECTION: `The data selection process was suddenly interrupted. Your previous data has not been saved. We are sorry, you will have to repeat the process again from the beginning.`,
    COMMAND_SETUP_NO_R1CS: `Unable to retrieve R1CS files from current working directory. Please, run this command from a working directory where the R1CS files are located to continue with the setup process. We kindly ask you to run the command from an empty directory containing only the R1CS files.`,
    COMMAND_SETUP_ABORT: `You chose to abort the setup process.`
}

/** Config */
export const CONFIG_ERRORS = {
    CONFIG_GITHUB_ERROR: `Configuration error. The Github client id environment variable has not been configured correctly.`,
    CONFIG_FIREBASE_ERROR: `Configuration error. The Firebase environment variable has not been configured correctly`,
    CONFIG_OTHER_ERROR: `Configuration error. One or more config environment variable has not been configured correctly`
}

/** Generic */
export const GENERIC_ERRORS = {
    GENERIC_ERROR_RETRIEVING_DATA: `Something went wrong when retrieving the data from the database`,
    GENERIC_FILE_ERROR: `File not found`,
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
