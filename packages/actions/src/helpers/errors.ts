import * as functions from "firebase-functions"
import { FunctionsErrorCode, HttpsError } from "firebase-functions/v1/https"
import { LogLevel } from "../types/enums"

/**
 * Create a new custom HTTPs error for cloud functions.
 * @notice the set of Firebase Functions status codes. The codes are the same at the
 * ones exposed by {@link https://github.com/grpc/grpc/blob/master/doc/statuscodes.md | gRPC}.
 * @param errorCode <FunctionsErrorCode> - the set of possible error codes.
 * @param message <string> - the error message.
 * @param [details] <string> - the details of the error (optional).
 * @returns <HttpsError>
 */
const makeError = (errorCode: FunctionsErrorCode, message: string, details?: string): HttpsError =>
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
 * Log and throw an HTTPs error.
 * @param error <HttpsError> - the error to be logged and thrown.
 */
export const logAndThrowError = (error: HttpsError) => {
    printLog(`${error.code}: ${error.message} ${!error.details ? "" : `\ndetails: ${error.details}`}`, LogLevel.ERROR)
    throw error
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
    CM_WRONG_CONFIGURATION: makeError(
        "failed-precondition",
        "Missing or incorrect configuration.",
        "This may happen due wrong environment configuration for the backend services."
    ),
    CM_NOT_AUTHENTICATED: makeError(
        "failed-precondition",
        "You are not authorized to perform this operation.",
        "You could not perform the requested operation because you are not authenticated on the Firebase Application."
    ),
    CM_INEXISTENT_DOCUMENT: makeError(
        "not-found",
        "Unable to find a document with the given identifier for the provided collection path."
    ),
    CM_INEXISTENT_DOCUMENT_DATA: makeError(
        "not-found",
        "The provided document with the given identifier has no data associated with it.",
        "This problem may occur if the document has not yet been written in the database."
    ),
    CM_INVALID_CEREMONY_FOR_PARTICIPANT: makeError(
        "not-found",
        "The participant does not seem to be related to a ceremony."
    ),
    CM_NO_CIRCUIT_FOR_GIVEN_SEQUENCE_POSITION: makeError(
        "not-found",
        "Unable to find the circuit having the provided sequence position for the given ceremony"
    ),
    CM_INVALID_REQUEST: makeError("unknown", "Failed request."),
    CM_INVALID_COMMAND_EXECUTION: makeError(
        "unknown",
        "There was an error while executing the command on the VM",
        "Please, contact the coordinator if the error persists."
    )
}
