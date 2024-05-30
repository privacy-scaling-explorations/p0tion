import * as functions from "firebase-functions"
import { FunctionsErrorCode, HttpsError } from "firebase-functions/v1/https"
import { LogLevel } from "../types/enums"
import { printLog } from "@p0tion/actions"

/**
 * Create a new custom HTTPs error for cloud functions.
 * @notice the set of Firebase Functions status codes. The codes are the same at the
 * ones exposed by {@link https://github.com/grpc/grpc/blob/master/doc/statuscodes.md | gRPC}.
 * @param errorCode <FunctionsErrorCode> - the set of possible error codes.
 * @param message <string> - the error message.
 * @param [details] <string> - the details of the error (optional).
 * @returns <HttpsError>
 */
export const makeError = (errorCode: FunctionsErrorCode, message: string, details?: string): HttpsError =>
    new functions.https.HttpsError(errorCode, message, details)

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
    SE_AUTH_USER_NOT_REPUTABLE: makeError(
        "permission-denied",
        "The authenticated user is not reputable.",
        "The authenticated user is not reputable. No document will be created in the relevant collection."
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
    SE_STORAGE_BUCKET_NOT_CONNECTED_TO_CEREMONY: makeError(
        "not-found",
        "Unable to generate a pre-signed url for the given object in the provided bucket.",
        "The bucket is not associated with any valid ceremony document on the Firestore database."
    ),
    SE_STORAGE_WRONG_OBJECT_KEY: makeError(
        "failed-precondition",
        "Unable to interact with a multi-part upload (start, create pre-signed urls or complete).",
        "The object key provided does not match the expected one."
    ),
    SE_STORAGE_CANNOT_INTERACT_WITH_MULTI_PART_UPLOAD: makeError(
        "failed-precondition",
        "Unable to interact with a multi-part upload (start, create pre-signed urls or complete).",
        "Authenticated user is not a current contributor which is currently in the uploading step."
    ),
    SE_STORAGE_DOWNLOAD_FAILED: makeError(
        "failed-precondition",
        "Unable to download the AWS S3 object from the provided ceremony bucket.",
        "This could happen if the file reference stored in the database or bucket turns out to be wrong or if the pre-signed url was not generated correctly."
    ),
    SE_STORAGE_UPLOAD_FAILED: makeError(
        "failed-precondition",
        "Unable to upload the file to the AWS S3 ceremony bucket.",
        "This could happen if the local file or bucket do not exist or if the pre-signed url was not generated correctly."
    ),
    SE_STORAGE_DELETE_FAILED: makeError(
        "failed-precondition",
        "Unable to delete the AWS S3 object from the provided ceremony bucket.",
        "This could happen if the local file or the bucket do not exist."
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
    SE_PARTICIPANT_CEREMONY_NOT_OPENED: makeError(
        "failed-precondition",
        "Unable to progress to next contribution step.",
        "The ceremony does not appear to be opened"
    ),
    SE_PARTICIPANT_NOT_CONTRIBUTING: makeError(
        "failed-precondition",
        "Unable to progress to next contribution step.",
        "This may happen due wrong contribution step from participant."
    ),
    SE_PARTICIPANT_CANNOT_STORE_PERMANENT_DATA: makeError(
        "failed-precondition",
        "Unable to store contribution hash and computing time.",
        "This may happen due wrong contribution step from participant or missing coordinator permission (only when finalizing)."
    ),
    SE_PARTICIPANT_CANNOT_STORE_TEMPORARY_DATA: makeError(
        "failed-precondition",
        "Unable to store temporary data to resume a multi-part upload.",
        "This may happen due wrong contribution step from participant."
    ),
    SE_VERIFICATION_NO_PARTICIPANT_CONTRIBUTION_DATA: makeError(
        "not-found",
        `Unable to retrieve current contribution data from participant document.`
    ),
    SE_CEREMONY_CANNOT_FINALIZE_CEREMONY: makeError(
        "failed-precondition",
        `Unable to finalize the ceremony.`,
        `Please, verify to have successfully completed the finalization of each circuit in the ceremony.`
    ),
    SE_FINALIZE_NO_CEREMONY_CONTRIBUTIONS: makeError(
        "not-found",
        "There are no contributions associated with the ceremony circuit.",
        "No documents in the contributions subcollection were found for the selected ceremony circuit."
    ),
    SE_FINALIZE_NO_FINAL_CONTRIBUTION: makeError(
        "not-found",
        "There is no final contribution associated with the ceremony circuit."
    ),
    SE_VM_NOT_RUNNING: makeError("failed-precondition", "The EC2 VM is not running yet"),
    SE_VM_FAILED_COMMAND_EXECUTION: makeError(
        "failed-precondition",
        "VM command execution failed",
        "Please, contact the coordinator if this error persists."
    ),
    SE_VM_TIMEDOUT_COMMAND_EXECUTION: makeError(
        "deadline-exceeded",
        "VM command execution took too long and has been timed-out",
        "Please, contact the coordinator if this error persists."
    ),
    SE_VM_CANCELLED_COMMAND_EXECUTION: makeError(
        "cancelled",
        "VM command execution has been cancelled",
        "Please, contact the coordinator if this error persists."
    ),
    SE_VM_DELAYED_COMMAND_EXECUTION: makeError(
        "unavailable",
        "VM command execution has been delayed since there were no available instance at the moment",
        "Please, contact the coordinator if this error persists."
    ),
    SE_VM_UNKNOWN_COMMAND_STATUS: makeError(
        "unavailable",
        "VM command execution has failed due to an unknown status code",
        "Please, contact the coordinator if this error persists."
    )
}
