import * as functions from "firebase-functions"
import { FunctionsErrorCode, HttpsError } from "firebase-functions/v1/https"
import { LogLevel } from "../../types/enums"

/**
 * Create a new custom HTTPs error for cloud functions.
 * @notice the set of Firebase Functions status codes. The codes are the same at the
 * ones exposed by {@link https://github.com/grpc/grpc/blob/master/doc/statuscodes.md | gRPC}.
 * @param errorCode <FunctionsErrorCode> - the set of possible error codes.
 * @param message <string> - the error messge.
 * @param [details] <string> - the details of the error (optional).
 * @returns <HttpsError>
 */
export const makeError = (errorCode: FunctionsErrorCode, message: string, details?: string): HttpsError =>
    new functions.https.HttpsError(errorCode, message, details)

/**
 * Log a custom message on console using a specific level.
 * @param message <string> - the message to be shown.
 * @param logLevel <LogLevel> - the level of the log to be used to show the message (e.g., debug, error).
 */
export const printLog = (message: string, logLevel: LogLevel) => {
    switch (logLevel) {
        case LogLevel.INFO:
            functions.logger.info(`[${logLevel}] ${message}`)
            break
        case LogLevel.DEBUG:
            functions.logger.debug(`[${logLevel}] ${message}`)
            break
        case LogLevel.WARN:
            functions.logger.warn(`[${logLevel}] ${message}`)
            break
        case LogLevel.ERROR:
            functions.logger.error(`[${logLevel}] ${message}`)
            break
        case LogLevel.LOG:
            functions.logger.log(`[${logLevel}] ${message}`)
            break
        default:
            console.log(`[${logLevel}] ${message}`)
            break
    }
}

/**
 * A set of Cloud Function specific errors.
 * @notice these are errors that happen only on specific cloud functions.
 */
export const SPECIFIC_ERRORS = {
    SE_AUTH_NO_CURRENT_AUTH_USER: makeError(
        "failed-precondition",
        "Unable to retrieve the authenticated user.",
        "Authenticated user information could not be retrieved. No document will be created in the relevant collection."
    ),
    SE_AUTH_SET_CUSTOM_USER_CLAIMS_FAIL: makeError(
        "invalid-argument",
        "Unable to set custom claims for authenticated user."
    )
}

/**
 * A set of common errors.
 * @notice these are errors that happen on multiple cloud functions (e.g., auth, missing data).
 */
export const COMMON_ERRORS = {
    CM_NOT_COORDINATOR_ROLE: makeError(
        "permission-denied",
        "You do not have privileges to perform this operation.",
        "Authenticated user does not have the coordinator role (missing custom claims)."
    ),
    CM_MISSING_OR_WRONG_INPUT_DATA: makeError(
        "invalid-argument",
        "Unable to perform the operation due to incomplete or incorrect data."
    ),
    GENERR_NO_AUTH_USER_FOUND: `The given id does not belong to an authenticated user`,
    GENERR_NO_COORDINATOR: `The given id does not belong to a coordinator`,
    GENERR_NO_CEREMONY_PROVIDED: `No ceremony has been provided`,
    GENERR_NO_CIRCUIT_PROVIDED: `No circuit has been provided`,
    GENERR_NO_CEREMONIES_OPENED: `No ceremonies are opened to contributions`,
    GENERR_INVALID_CEREMONY: `The given ceremony is invalid`,
    GENERR_INVALID_CIRCUIT: `The given circuit is invalid`,
    GENERR_INVALID_PARTICIPANT: `The given participant is invalid`,
    GENERR_CEREMONY_NOT_OPENED: `The given ceremony is not opened to contributions`,
    GENERR_CEREMONY_NOT_CLOSED: `The given ceremony is not closed for finalization`,
    GENERR_INVALID_PARTICIPANT_STATUS: `The participant has an invalid status`,
    GENERR_INVALID_PARTICIPANT_CONTRIBUTION_STEP: `The participant has an invalid contribution step`,
    GENERR_INVALID_CONTRIBUTION_PROGRESS: `The contribution progress is invalid`,
    GENERR_INVALID_DOCUMENTS: `One or more provided identifier does not belong to a document`,
    GENERR_NO_DATA: `Data not found`,
    GENERR_NO_CIRCUIT: `Circuits not found`,
    GENERR_NO_PARTICIPANT: `Participant not found`,
    GENERR_NO_CONTRIBUTION: `Contributions not found`,
    GENERR_NO_CURRENT_CONTRIBUTOR: `There is no current contributor for the circuit`,
    GENERR_NO_TIMEOUT_FIRST_COTRIBUTOR: `Cannot compute a dynamic timeout for the first contributor`,
    GENERR_NO_CIRCUITS: `Circuits not found for the ceremony`,
    GENERR_NO_CONTRIBUTIONS: `Contributions not found for the circuit`,
    GENERR_NO_RETRY: `The retry waiting time has not passed away yet`,
    GENERR_WRONG_PATHS: `Wrong storage or database paths`,
    GENERR_WRONG_FIELD: `Wrong document field`,
    GENERR_WRONG_ENV_CONFIGURATION: `Your environment variables are not configured properly`
}
