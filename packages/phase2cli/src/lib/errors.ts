import theme from "./theme"

/** Services */
export const CORE_SERVICES_ERRORS = {
    FIREBASE_DEFAULT_APP_DOUBLE_CONFIG: `Wrong double default configuration for Firebase application`,
    FIREBASE_TOKEN_EXPIRED_REMOVED_PERMISSIONS: `The Github authorization has failed due to lack of association between your account and the CLI`,
    FIREBASE_USER_DISABLED: `The Github account has been suspended by the ceremony coordinator(s), blocking the possibility of contribution. Please, contact them to understand the motivation behind it.`,
    FIREBASE_FAILED_CREDENTIALS_VERIFICATION: `Firebase cannot verify your Github credentials due to network errors. Please, try once again later.`,
    FIREBASE_NETWORK_ERROR: `Unable to reach Firebase due to network erros. Please, try once again later and make sure your Internet connection is stable.`,
    FIREBASE_CEREMONY_NOT_OPENED: `There are no ceremonies opened to contributions`,
    FIREBASE_CEREMONY_NOT_CLOSED: `There are no ceremonies ready to finalization`,
    AWS_CEREMONY_BUCKET_CREATION: `Unable to create a new bucket for the ceremony. Something went wrong during the creation. Please, repeat the process by providing a new ceremony name of the ceremony.`,
    AWS_CEREMONY_BUCKET_CANNOT_DOWNLOAD_GET_PRESIGNED_URL: `Unable to download the file from the ceremony bucket. This problem could be related to failure when generating the pre-signed url. Please, we kindly ask you to terminate the current session and repeat the process.`
}

/** Github */
export const THIRD_PARTY_SERVICES_ERRORS = {
    GITHUB_ACCOUNT_ASSOCIATION_REJECTED: `You have decided not to associate the CLI application with your Github account. This declination will not allow you to make a contribution to any ceremony. In case you made a mistake, you can always repeat the process and accept the association of your Github account with the CLI.`,
    GITHUB_SERVER_TIMEDOUT: `Github's servers are experiencing downtime. Please, try once again later and make sure your Internet connection is stable.`,
    GITHUB_GET_GITHUB_ACCOUNT_INFO: `Something went wrong while retrieving your Github account public information (handle and identifier). Please, try once again later`,
    GITHUB_NOT_AUTHENTICATED: `You are unable to execute the command since you have not authorized this device with your Github account. Please, execute the auth command (\`phase2cli auth\`) and then re-run this command.`,
    GITHUB_GIST_PUBLICATION_FAILED: `Unable to publish the public attestation as gist making the request using your authenticated Github account. Please, verify that you have allowed the 'gist' access permission during the authentication step.`
}

/** Command */
export const COMMAND_ERRORS = {
    COMMAND_NOT_COORDINATOR: `Unable to execute the command. In order to perform coordinator functionality you must authenticate with an account having adeguate permissions.`,
    COMMAND_ABORT_PROMPT: `The data submission process was suddenly interrupted. Your previous data has not been saved. We are sorry, you will have to repeat the process again from the beginning.`,
    COMMAND_ABORT_SELECTION: `The data selection process was suddenly interrupted. Your previous data has not been saved. We are sorry, you will have to repeat the process again from the beginning.`,
    COMMAND_SETUP_NO_R1CS: `Unable to retrieve R1CS files from current working directory. Please, run this command from a working directory where the R1CS files are located to continue with the setup process. We kindly ask you to run the command from an empty directory containing only the R1CS and WASM files.`,
    COMMAND_SETUP_NO_WASM: `Unable to retrieve WASM files from current working directory. Please, run this command from a working directory where the WASM files are located to continue with the setup process. We kindly ask you to run the command from an empty directory containing only the WASM and R1CS files.`,
    COMMAND_SETUP_MISMATCH_R1CS_WASM: `The folder contains more R1CS files than WASM files (or vice versa). Please, run this command from a working directory where each R1CS is paired with its corresponding file WASM.`,
    COMMAND_SETUP_DOWNLOAD_PTAU: `Unable to download Powers of Tau file from Hermez Cryptography Phase 1 Trusted Setup. Possible causes may involve an error while making the request (be sure to have a stable internet connection). Please, we kindly ask you to terminate the current session and repeat the process.`,
    COMMAND_SETUP_ABORT: `You chose to abort the setup process.`,
    COMMAND_CONTRIBUTE_NO_OPENED_CEREMONIES: `Unfortunately, there is no ceremony for which you can make a contribution at this time. Please, try again later.`,
    COMMAND_CONTRIBUTE_NO_PARTICIPANT_DATA: `Unable to retrieve your data as ceremony participant. Please, terminate the current session and try again later. If the error persists, please contact the ceremony coordinator.`,
    COMMAND_CONTRIBUTE_NO_CURRENT_CONTRIBUTOR_DATA: `Unable to retrieve current circuit contributor information. Please, terminate the current session and try again later. If the error persists, please contact the ceremony coordinator.`,
    COMMAND_CONTRIBUTE_NO_CURRENT_CONTRIBUTOR_CONTRIBUTION: `Unable to retrieve circuit last contribution information. This could happen due to a timeout or some errors while writing the information on the database.`,
    COMMAND_CONTRIBUTE_WRONG_CURRENT_CONTRIBUTOR_CONTRIBUTION_STEP: `Something went wrong when progressing the contribution step of the current circuit contributor. If the error persists, please contact the ceremony coordinator.`,
    COMMAND_CONTRIBUTE_NO_CIRCUIT_DATA: `Unable to retrieve circuit data from the ceremony. Please, terminate the current session and try again later. If the error persists, please contact the ceremony coordinator.`,
    COMMAND_CONTRIBUTE_NO_ACTIVE_TIMEOUT_DATA: `Unable to retrieve your active timeout data. This problem could be related to failure to write timeout data to the database. If the error persists, please contact the ceremony coordinator.`,
    COMMAND_CONTRIBUTE_NO_UNIQUE_ACTIVE_TIMEOUTS: `The number of active timeouts is different from one. This problem could be related to failure to update timeout document in the database. If the error persists, please contact the ceremony coordinator.`,
    COMMAND_CONTRIBUTE_NO_ROOT_DISK_SPACE: `Unable to identify your root disk to estimate the free disk space available for the next contribution. Please verify that there is a root disk mounted on the machine from which you run this command. If the error persists, contact the coordinator.`,
    COMMAND_CONTRIBUTE_FINALIZE_NO_TRANSCRIPT_CONTRIBUTION_HASH_MATCH: `Unable to retrieve contribution hash from transcript. Possible causes may involve an error while using the logger or unexpected file descriptor termination. Please, terminate the current session and repeat the process.`,
    COMMAND_FINALIZED_NO_CLOSED_CEREMONIES: `Unfortunately, there is no ceremony closed and ready for finalization. Please, try again later.`,
    COMMAND_FINALIZED_NOT_READY_FOR_FINALIZATION: `You are not ready for ceremony finalization. This could happen because the ceremony does not appear closed or you do not have completed every circuit contributions. If the error persists, please contact the operator to check the server logs.`
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
    GENERIC_FILE_NOT_FOUND_ERROR: `Unable to locate the required file on the given folder.`,
    GENERIC_COUNTDOWN_EXPIRATION: `Your time to carry out the action has expired`
}

/**
 * Print an error string and gracefully terminate the process.
 * @param err <string> - the error string to be shown.
 * @param doExit <boolean> - when true the function terminate the process; otherwise not.
 */
export const showError = (err: string, doExit: boolean) => {
    // Print the error.
    console.error(`${theme.symbols.error} ${err}`)

    // Terminate the process.
    if (doExit) process.exit(0)
}
