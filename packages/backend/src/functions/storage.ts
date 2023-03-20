import * as functions from "firebase-functions"
import admin from "firebase-admin"
import {
    GetObjectCommand,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
    HeadObjectCommand,
    CreateBucketCommand
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import dotenv from "dotenv"
import { commonTerms, formatZkeyIndex, getParticipantsCollectionPath, getZkeyStorageFilePath } from "@zkmpc/actions/src"
import { ParticipantStatus, ParticipantContributionStep } from "@zkmpc/actions/src/types/enums"
import { getCeremonyCircuits, getDocumentById } from "../lib/utils"
import { COMMON_ERRORS, logAndThrowError, makeError, printLog, SPECIFIC_ERRORS } from "../lib/errors"
import { LogLevel } from "../../types/enums"
import { getS3Client } from "../lib/services"
import {
    BucketAndObjectKeyData,
    CompleteMultiPartUploadData,
    CreateBucketData,
    GeneratePreSignedUrlsPartsData,
    StartMultiPartUploadData
} from "../../types"

dotenv.config()

/**
 * Check if the pre-condition for interacting w/ a multi-part upload for an identified current contributor is valid.
 * @notice the precondition is be a current contributor (contributing status) in the uploading contribution step.
 * @param contributorId <string> - the unique identifier of the contributor.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 */
const checkPreConditionForCurrentContributorToInteractWithMultiPartUpload = async (
    contributorId: string,
    ceremonyId: string
) => {
    // Get ceremony and participant documents.
    const ceremonyDoc = await getDocumentById(commonTerms.collections.ceremonies.name, ceremonyId)
    const participantDoc = await getDocumentById(getParticipantsCollectionPath(ceremonyId), contributorId!)

    // Get data from docs.
    const ceremonyData = ceremonyDoc.data()
    const participantData = participantDoc.data()

    if (!ceremonyData || !participantData) logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

    // Check pre-condition to start multi-part upload for a current contributor.
    const { status, contributionStep } = participantData!

    if (status !== ParticipantStatus.CONTRIBUTING && contributionStep !== ParticipantContributionStep.UPLOADING)
        logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_CANNOT_INTERACT_WITH_MULTI_PART_UPLOAD)
}

/**
 * Helper function to check whether a contributor is uploading a file related to its contribution.
 * @param contributorId <string> - the unique identifier of the contributor.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param objectKey <string> - the object key of the file being uploaded.
 */
const checkUploadingFileValidity = async (contributorId: string, ceremonyId: string, objectKey: string) => {
    // Get the circuits for the ceremony
    const circuits = await getCeremonyCircuits(ceremonyId)

    // Get the participant document
    const participantDoc = await getDocumentById(getParticipantsCollectionPath(ceremonyId), contributorId!)
    const participantData = participantDoc.data()

    if (!participantData) logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

    // The index of the circuit will be the contribution progress - 1
    const index = participantData?.contributionProgress
    // If the index is zero the user is not the current contributor
    if (index === 0) logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_CANNOT_INTERACT_WITH_MULTI_PART_UPLOAD)
    // We can safely use index - 1
    const circuit = circuits.at(index - 1)

    // If the circuit is undefined, throw an error
    if (!circuit) logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_CANNOT_INTERACT_WITH_MULTI_PART_UPLOAD)
    // Extract the data we need
    const { prefix, waitingQueue } = circuit!.data()
    const { completedContributions, currentContributor } = waitingQueue

    // If we are not a contributor to this circuit then we cannot upload files
    if (currentContributor === contributorId) {
        // Get the index of the zKey
        const contributorZKeyIndex = formatZkeyIndex(completedContributions + 1)
        // The uploaded file must be the expected one
        const zkeyNameContributor = `${prefix}_${contributorZKeyIndex}.zkey`
        const contributorZKeyStoragePath = getZkeyStorageFilePath(prefix, zkeyNameContributor)

        // If the object key does not have the expected storage path, throw an error
        if (objectKey !== contributorZKeyStoragePath) {
            logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_WRONG_OBJECT_KEY)
        }
    } else logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_CANNOT_INTERACT_WITH_MULTI_PART_UPLOAD)
}

/**
 * Helper function that confirms whether a bucket is used for a ceremony.
 * @dev this helps to prevent unauthorized access to coordinator's buckets.
 * @param bucketName
 */
const checkIfBucketIsDedicatedToCeremony = async (bucketName: string) => {
    // Get Firestore DB.
    const firestoreDatabase = admin.firestore()

    // Extract ceremony prefix from bucket name.
    const ceremonyPrefix = bucketName.replace(String(process.env.AWS_CEREMONY_BUCKET_POSTFIX), "")

    // Query the collection.
    const ceremonyCollection = await firestoreDatabase
        .collection(commonTerms.collections.ceremonies.name)
        .where(commonTerms.collections.ceremonies.fields.prefix, "==", ceremonyPrefix)
        .get()

    if (ceremonyCollection.empty) logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_BUCKET_NOT_CONNECTED_TO_CEREMONY)
}

/**
 * Create a new AWS S3 bucket for a particular ceremony.
 * @notice the S3 bucket is used to store all the ceremony artifacts and contributions.
 */
export const createBucket = functions.https.onCall(
    async (data: CreateBucketData, context: functions.https.CallableContext) => {
        // Check if the user has the coordinator claim.
        if (!context.auth || !context.auth.token.coordinator) logAndThrowError(COMMON_ERRORS.CM_NOT_COORDINATOR_ROLE)

        if (!data.bucketName) logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Connect to S3 client.
        const S3 = await getS3Client()

        // Prepare S3 command.
        const command = new CreateBucketCommand({
            Bucket: data.bucketName,
            CreateBucketConfiguration: {
                LocationConstraint: String(process.env.AWS_REGION)
            }
        })

        try {
            // Execute S3 command.
            const response = await S3.send(command)

            // Check response.
            if (response.$metadata.httpStatusCode === 200 && !!response.Location)
                printLog(`The AWS S3 bucket ${data.bucketName} has been created successfully`, LogLevel.LOG)
        } catch (error: any) {
            /** * {@link https://docs.aws.amazon.com/simspaceweaver/latest/userguide/troubleshooting_bucket-name-too-long.html | InvalidBucketName} */
            if (error.$metadata.httpStatusCode === 400 && error.Code === `InvalidBucketName`)
                logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_INVALID_BUCKET_NAME)

            /** * {@link https://docs.aws.amazon.com/simspaceweaver/latest/userguide/troubeshooting_too-many-buckets.html | TooManyBuckets} */
            if (error.$metadata.httpStatusCode === 400 && error.Code === `TooManyBuckets`)
                logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_TOO_MANY_BUCKETS)

            // @todo handle more errors here.

            const commonError = COMMON_ERRORS.CM_INVALID_REQUEST
            const additionalDetails = error.toString()

            logAndThrowError(makeError(commonError.code, commonError.message, additionalDetails))
        }
    }
)

/**
 * Check if a specified object exist in a given AWS S3 bucket.
 * @returns <Promise<boolean>> - true if the object exist in the given bucket; otherwise false.
 */
export const checkIfObjectExist = functions.https.onCall(
    async (data: BucketAndObjectKeyData, context: functions.https.CallableContext): Promise<boolean> => {
        // Check if the user has the coordinator claim.
        if (!context.auth || !context.auth.token.coordinator) logAndThrowError(COMMON_ERRORS.CM_NOT_COORDINATOR_ROLE)

        if (!data.bucketName || !data.objectKey) logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Connect to S3 client.
        const S3 = await getS3Client()

        // Prepare S3 command.
        const command = new HeadObjectCommand({ Bucket: data.bucketName, Key: data.objectKey })

        try {
            // Execute S3 command.
            const response = await S3.send(command)

            // Check response.
            if (response.$metadata.httpStatusCode === 200 && !!response.ETag) {
                printLog(
                    `The object associated w/ ${data.objectKey} key has been found in the ${data.bucketName} bucket`,
                    LogLevel.LOG
                )

                return true
            }
        } catch (error: any) {
            if (error.$metadata.httpStatusCode === 403) logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_MISSING_PERMISSIONS)

            // @todo handle more specific errors here.

            // nb. do not handle common errors! This method must return false if not found!
            // const commonError = COMMON_ERRORS.CM_INVALID_REQUEST
            // const additionalDetails = error.toString()

            // logAndThrowError(makeError(
            //     commonError.code,
            //     commonError.message,
            //     additionalDetails
            // ))
        }

        return false
    }
)

/**
 * Return a pre-signed url for a given object contained inside the provided AWS S3 bucket in order to perform a GET request.
 * @notice the pre-signed url has a predefined expiration expressed in seconds inside the environment
 * configuration of the `backend` package. The value should match the configuration of `phase2cli` package
 * environment to avoid inconsistency between client request and CF.
 */
export const generateGetObjectPreSignedUrl = functions.https.onCall(
    async (data: BucketAndObjectKeyData, context: functions.https.CallableContext): Promise<any> => {
        if (!context.auth) logAndThrowError(COMMON_ERRORS.CM_NOT_AUTHENTICATED)

        if (!data.bucketName || !data.objectKey) logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Prepare input data.
        const { objectKey, bucketName } = data

        // Check whether the bucket for which we are generating the pre-signed url is dedicated to a ceremony.
        await checkIfBucketIsDedicatedToCeremony(bucketName)

        // Connect to S3 client.
        const S3 = await getS3Client()

        // Prepare S3 command.
        const command = new GetObjectCommand({ Bucket: bucketName, Key: objectKey })

        try {
            // Execute S3 command.
            const url = await getSignedUrl(S3, command, { expiresIn: Number(process.env.AWS_PRESIGNED_URL_EXPIRATION) })

            if (url) {
                printLog(`The generated pre-signed url is ${url}`, LogLevel.DEBUG)

                return url
            }
        } catch (error: any) {
            // @todo handle more errors here.
            // if (error.$metadata.httpStatusCode !== 200) {
            const commonError = COMMON_ERRORS.CM_INVALID_REQUEST
            const additionalDetails = error.toString()

            logAndThrowError(makeError(commonError.code, commonError.message, additionalDetails))
            // }
        }
    }
)

/**
 * Start a new multi-part upload for a specific object in the given AWS S3 bucket.
 * @notice this operation can be performed by either an authenticated participant or a coordinator.
 */
export const startMultiPartUpload = functions.https.onCall(
    async (data: StartMultiPartUploadData, context: functions.https.CallableContext): Promise<any> => {
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            logAndThrowError(COMMON_ERRORS.CM_NOT_AUTHENTICATED)

        if (!data.bucketName || !data.objectKey || (context.auth?.token.participant && !data.ceremonyId))
            logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Prepare data.
        const { bucketName, objectKey, ceremonyId } = data
        const userId = context.auth?.uid

        // Check if the user is a current contributor.
        if (context.auth?.token.participant && !!ceremonyId) {
            // Check pre-condition.
            await checkPreConditionForCurrentContributorToInteractWithMultiPartUpload(userId!, ceremonyId)

            // Check whether the bucket where the object for which we are generating the pre-signed url is dedicated to a ceremony.
            await checkIfBucketIsDedicatedToCeremony(bucketName)

            // Check the validity of the uploaded file.
            await checkUploadingFileValidity(userId!, ceremonyId!, objectKey)
        }

        // Connect to S3 client.
        const S3 = await getS3Client()

        // Prepare S3 command.
        const command = new CreateMultipartUploadCommand({ Bucket: bucketName, Key: objectKey })

        try {
            // Execute S3 command.
            const response = await S3.send(command)
            if (response.$metadata.httpStatusCode === 200 && !!response.UploadId) {
                printLog(
                    `The multi-part upload identifier is ${response.UploadId}. Requested by ${userId}`,
                    LogLevel.DEBUG
                )

                return response.UploadId
            }
        } catch (error: any) {
            // @todo handle more errors here.
            if (error.$metadata.httpStatusCode !== 200) {
                const commonError = COMMON_ERRORS.CM_INVALID_REQUEST
                const additionalDetails = error.toString()

                logAndThrowError(makeError(commonError.code, commonError.message, additionalDetails))
            }
        }
    }
)

/**
 * Generate a new pre-signed url for each chunk related to a started multi-part upload.
 * @notice this operation can be performed by either an authenticated participant or a coordinator.
 * the pre-signed url has a predefined expiration expressed in seconds inside the environment
 * configuration of the `backend` package. The value should match the configuration of `phase2cli` package
 * environment to avoid inconsistency between client request and CF.
 */
export const generatePreSignedUrlsParts = functions.https.onCall(
    async (data: GeneratePreSignedUrlsPartsData, context: functions.https.CallableContext): Promise<Array<string>> => {
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            logAndThrowError(COMMON_ERRORS.CM_NOT_AUTHENTICATED)

        if (
            !data.bucketName ||
            !data.objectKey ||
            !data.uploadId ||
            data.numberOfParts <= 0 ||
            (context.auth?.token.participant && !data.ceremonyId)
        )
            logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Prepare data.
        const { bucketName, objectKey, uploadId, numberOfParts, ceremonyId } = data
        const userId = context.auth?.uid

        // Check if the user is a current contributor.
        if (context.auth?.token.participant && !!ceremonyId) {
            // Check pre-condition.
            await checkPreConditionForCurrentContributorToInteractWithMultiPartUpload(userId!, ceremonyId)
        }

        // Connect to S3 client.
        const S3 = await getS3Client()

        // Prepare state.
        const parts = []

        for (let i = 0; i < numberOfParts; i += 1) {
            // Prepare S3 command for each chunk.
            const command = new UploadPartCommand({
                Bucket: bucketName,
                Key: objectKey,
                PartNumber: i + 1,
                UploadId: uploadId
            })

            try {
                // Get the pre-signed url for the specific chunk.
                const url = await getSignedUrl(S3, command, {
                    expiresIn: Number(process.env.AWS_PRESIGNED_URL_EXPIRATION)
                })

                if (url) {
                    // Save.
                    parts.push(url)
                }
            } catch (error: any) {
                // @todo handle more errors here.
                // if (error.$metadata.httpStatusCode !== 200) {
                const commonError = COMMON_ERRORS.CM_INVALID_REQUEST
                const additionalDetails = error.toString()

                logAndThrowError(makeError(commonError.code, commonError.message, additionalDetails))
                // }
            }
        }

        return parts
    }
)

/**
 * Complete a multi-part upload for a specific object in the given AWS S3 bucket.
 * @notice this operation can be performed by either an authenticated participant or a coordinator.
 */
export const completeMultiPartUpload = functions.https.onCall(
    async (data: CompleteMultiPartUploadData, context: functions.https.CallableContext): Promise<any> => {
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            logAndThrowError(COMMON_ERRORS.CM_NOT_AUTHENTICATED)

        if (
            !data.bucketName ||
            !data.objectKey ||
            !data.uploadId ||
            !data.parts ||
            (context.auth?.token.participant && !data.ceremonyId)
        )
            logAndThrowError(COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA)

        // Prepare data.
        const { bucketName, objectKey, uploadId, parts, ceremonyId } = data
        const userId = context.auth?.uid

        // Check if the user is a current contributor.
        if (context.auth?.token.participant && !!ceremonyId) {
            // Check pre-condition.
            await checkPreConditionForCurrentContributorToInteractWithMultiPartUpload(userId!, ceremonyId)

            // Check if the bucket is dedicated to a ceremony.
            await checkIfBucketIsDedicatedToCeremony(bucketName)
        }

        // Connect to S3.
        const S3 = await getS3Client()

        // Prepare S3 command.
        const command = new CompleteMultipartUploadCommand({
            Bucket: bucketName,
            Key: objectKey,
            UploadId: uploadId,
            MultipartUpload: { Parts: parts }
        })

        try {
            // Execute S3 command.
            const response = await S3.send(command)

            if (response.$metadata.httpStatusCode === 200 && !!response.Location) {
                printLog(
                    `Multi-part upload ${data.uploadId} completed. Object location: ${response.Location}`,
                    LogLevel.DEBUG
                )

                return response.Location
            }
        } catch (error: any) {
            // @todo handle more errors here.
            if (error.$metadata.httpStatusCode !== 200) {
                const commonError = COMMON_ERRORS.CM_INVALID_REQUEST
                const additionalDetails = error.toString()

                logAndThrowError(makeError(commonError.code, commonError.message, additionalDetails))
            }
        }
    }
)
