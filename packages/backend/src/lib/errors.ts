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
 * Log and throw an HTTPs error.
 * @param error <HttpsError> - the error to be logged and thrown.
 */
export const logAndThrowError = (error: HttpsError) => {
    printLog(`${error.code}: ${error.message} ${!error.details ? "" : `\ndetails: ${error.details}`}`, LogLevel.ERROR)
    throw error
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
    ),
    SE_STORAGE_INVALID_BUCKET_NAME: makeError(
        "already-exists",
        "Unable to create the AWS S3 bucket for the ceremony since the provided name is already in use. Please, provide a different bucket name for the ceremony.",
        "More info about the error could be found at the following link https://docs.aws.amazon.com/simspaceweaver/latest/userguide/troubleshooting_bucket-name-too-long.html"
    ),
    SE_STORAGE_TOO_MANY_BUCKETS: makeError(
        "resource-exhausted",
        "Unable to create the AWS S3 bucket for the ceremony since the are too many buckets already in use. Please, delete 2 or more existing Amazon S3 buckets that you don't need or increase your limits.",
        "More info about the error could be found at the following link https://docs.aws.amazon.com/simspaceweaver/latest/userguide/troubeshooting_too-many-buckets.html"
    ),
    SE_STORAGE_MISSING_PERMISSIONS: makeError(
        "permission-denied",
        "You do not have privileges to perform this operation.",
        "Authenticated user does not have proper permissions on AWS S3."
    ),
    SE_STORAGE_OBJECT_NOT_FOUND: makeError(
        "not-found",
        "Unable to retrieve the object from bucket.",
        "The object key is not associated with any object on the provided AWS S3 bucket."
    ),
    SE_STORAGE_BUCKET_NOT_CONNECTED_TO_CEREMONY: makeError(
        "not-found",
        "Unable to generate a pre-signed url for the given object in the provided bucket.",
        "The bucket is not associated with any valid ceremony document on the Firestore database."
    ),
    SE_STORAGE_CANNOT_INTERACT_WITH_MULTI_PART_UPLOAD: makeError(
        "failed-precondition",
        "Unable to interact with a multi-part upload (start, create pre-signed urls or complete).",
        "Authenticated user is not a current contributor which is currently in the uploading step."
    ),
    SE_CONTRIBUTE_NO_CEREMONY_CIRCUITS: makeError(
        "not-found",
        "There is no circuit associated with the ceremony.",
        "No documents in the circuits subcollection were found for the selected ceremony."
    ),
    SE_CONTRIBUTE_NO_OPENED_CEREMONIES: makeError("not-found", "There are no ceremonies open to contributions."),
    SE_CONTRIBUTE_CANNOT_PROGRESS_TO_NEXT_CIRCUIT: makeError(
        "failed-precondition",
        "Unable to progress to next circuit for contribution",
        "In order to progress for the contribution the participant must have just been registered for the ceremony or have just finished a contribution."
    ),
    SE_CONTRIBUTE_CANNOT_RESUME_CONTRIBUTION_AFTER_TIMEOUT_EXPIRATION: makeError(
        "failed-precondition",
        "Unable to resume your contribution.",
        "To resume contribution, the contributor must have the last timeout in progress verified has expired."
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
    CM_NO_CURRENT_CONTRIBUTOR: makeError("not-found", "No current contributors for the ceremony."),
    CM_INVALID_REQUEST: makeError("unknown", "Failed request."),
    /// @todo to be refactored.
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
