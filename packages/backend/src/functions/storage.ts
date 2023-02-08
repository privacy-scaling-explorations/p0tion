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
import { commonTerms, getParticipantsCollectionPath } from "@zkmpc/actions/src"
import { ParticipantStatus, ParticipantContributionStep } from "@zkmpc/actions/src/types/enums"
import { COMMON_ERRORS, printLog } from "../lib/errors"
import { LogLevel } from "../../types/enums"
import { getS3Client } from "../lib/utils"

dotenv.config()

/**
 * Create a new AWS S3 bucket for a particular ceremony.
 */
export const createBucket = functions.https.onCall(
    async (data: any, context: functions.https.CallableContext): Promise<any> => {
        // Checks.
        if (!context.auth || !context.auth.token.coordinator)
            printLog(COMMON_ERRORS.GENERR_NO_COORDINATOR, LogLevel.ERROR)

        if (!data.bucketName) {
            const error = COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA

            printLog(
                `${error.code}: ${error.message} ${!error.details ? "" : `\ndetails: ${error.details}`}`,
                LogLevel.ERROR
            )
            throw error
        }

        // Connect w/ S3.
        const S3 = await getS3Client()

        // Prepare command.
        const command = new CreateBucketCommand({
            Bucket: data.bucketName,
            CreateBucketConfiguration: {
                LocationConstraint: process.env.AWS_REGION!
            }
        })

        try {
            // Send command.
            const response = await S3.send(command)

            // Check response.
            if (response.$metadata.httpStatusCode === 200 && !!response.Location) {
                printLog(`Bucket successfully created`, LogLevel.LOG)

                return true
            }
        } catch (error: any) {
            if (error.$metadata.httpStatusCode === 400 && error.Code === "InvalidBucketName") {
                printLog(`Bucket not created: ${error.Code}`, LogLevel.LOG)
            }

            printLog(`Generic error when creating a new S3 bucket: ${error}`, LogLevel.ERROR)
        }

        return false
    }
)

/**
 * Check if a specified object exist in a given AWS S3 bucket.
 */
export const checkIfObjectExist = functions.https.onCall(
    async (data: any, context: functions.https.CallableContext): Promise<any> => {
        // Checks.
        if (!context.auth || !context.auth.token.coordinator)
            printLog(COMMON_ERRORS.GENERR_NO_COORDINATOR, LogLevel.ERROR)

        if (!data.bucketName || !data.objectKey) {
            const error = COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA

            printLog(
                `${error.code}: ${error.message} ${!error.details ? "" : `\ndetails: ${error.details}`}`,
                LogLevel.ERROR
            )
            throw error
        }

        // Connect w/ S3.
        const S3 = await getS3Client()

        // Prepare command.
        const command = new HeadObjectCommand({ Bucket: data.bucketName, Key: data.objectKey })

        try {
            // Send command.
            const response = await S3.send(command)

            // Check response.
            if (response.$metadata.httpStatusCode === 200 && !!response.ETag) {
                printLog(`Object: ${data.objectKey} exists!`, LogLevel.LOG)

                return true
            }
        } catch (error: any) {
            if (error.$metadata.httpStatusCode === 404 && !error.ETag) {
                printLog(`Object: ${data.objectKey} does not exist!`, LogLevel.LOG)

                return false
            }

            printLog(`Generic error when checking for object on S3 bucket: ${error}`, LogLevel.ERROR)
        }

        return false
    }
)

/**
 * Generate a new AWS S3 pre signed url to upload/download an object (GET).
 */
export const generateGetObjectPreSignedUrl = functions.https.onCall(
    async (data: any, context: functions.https.CallableContext): Promise<any> => {
        if (!process.env.CONFIG_CEREMONY_BUCKET_POSTFIX) throw new Error(COMMON_ERRORS.GENERR_WRONG_ENV_CONFIGURATION)
        // requires auth
        if (!context.auth) printLog(COMMON_ERRORS.GENERR_NO_AUTH_USER_FOUND, LogLevel.ERROR)

        if (!data.bucketName || !data.objectKey) {
            const error = COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA

            printLog(
                `${error.code}: ${error.message} ${!error.details ? "" : `\ndetails: ${error.details}`}`,
                LogLevel.ERROR
            )
            throw error
        }

        // extract the bucket name and object key from the data
        const { objectKey, bucketName } = data

        // get the firestore database
        const firestoreDatabase = admin.firestore()

        // need to get the ceremony prefix from the bucket name
        const ceremonyPrefix = bucketName.replace(process.env.CONFIG_CEREMONY_BUCKET_POSTFIX!, "")

        // query the collection
        const ceremonyCollection = await firestoreDatabase
            .collection(commonTerms.collections.ceremonies.name)
            .where("prefix", "==", ceremonyPrefix)
            .get()

        // if there is no collection with this name then we return
        if (ceremonyCollection.empty)
            printLog(
                `Cannot get pre-signed url for this object: ${objectKey} in bucket: ${bucketName} because it does not belong to any ceremony.`,
                LogLevel.ERROR
            )

        // Connect w/ S3.
        const S3 = await getS3Client()

        // Prepare the command.
        const command = new GetObjectCommand({ Bucket: bucketName, Key: objectKey })

        // Get the PreSignedUrl.
        const url = await getSignedUrl(S3, command, { expiresIn: Number(process.env.AWS_PRESIGNED_URL_EXPIRATION!) })

        printLog(`Single Pre-Signed URL ${url}`, LogLevel.LOG)

        return url
    }
)

/**
 * Initiate a multi part upload for a specific object in AWS S3 bucket.
 */
export const startMultiPartUpload = functions.https.onCall(
    async (data: any, context: functions.https.CallableContext): Promise<any> => {
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            printLog(COMMON_ERRORS.GENERR_NO_AUTH_USER_FOUND, LogLevel.ERROR)

        if (!data.bucketName || !data.objectKey || (context.auth?.token.participant && !data.ceremonyId)) {
            const error = COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA

            printLog(
                `${error.code}: ${error.message} ${!error.details ? "" : `\ndetails: ${error.details}`}`,
                LogLevel.ERROR
            )
            throw error
        }

        // Get DB.
        const firestore = admin.firestore()

        // Get data.
        const { bucketName, objectKey, ceremonyId } = data
        const userId = context.auth?.uid

        if (context.auth?.token.participant && !!ceremonyId) {
            // Look for documents.
            const ceremonyDoc = await firestore
                .collection(commonTerms.collections.ceremonies.name)
                .doc(ceremonyId)
                .get()
            const participantDoc = await firestore
                .collection(getParticipantsCollectionPath(ceremonyId))
                .doc(userId!)
                .get()

            if (!ceremonyDoc.exists || !participantDoc.exists)
                printLog(COMMON_ERRORS.GENERR_INVALID_DOCUMENTS, LogLevel.ERROR)

            // Get data from docs.
            const ceremonyData = ceremonyDoc.data()
            const participantData = participantDoc.data()

            if (!ceremonyData || !participantData) printLog(COMMON_ERRORS.GENERR_NO_DATA, LogLevel.ERROR)

            printLog(`Ceremony document ${ceremonyDoc.id} okay`, LogLevel.DEBUG)
            printLog(`Participant document ${participantDoc.id} okay`, LogLevel.DEBUG)

            // Check participant status and contribution step.
            const { status, contributionStep } = participantData!

            if (status !== ParticipantStatus.CONTRIBUTING && contributionStep !== ParticipantContributionStep.UPLOADING)
                printLog(
                    `Participant ${participantDoc.id} is not able to start a multi part upload right now`,
                    LogLevel.ERROR
                )
        }

        // Connect w/ S3.
        const S3 = await getS3Client()

        // Prepare command.
        const command = new CreateMultipartUploadCommand({ Bucket: bucketName, Key: objectKey })

        // Send command.
        const responseInitiate = await S3.send(command)
        const uploadId = responseInitiate.UploadId

        printLog(`Upload ID: ${uploadId}`, LogLevel.LOG)

        return uploadId
    }
)

/**
 * Generate a PreSignedUrl for each part of the given multi part upload.
 */
export const generatePreSignedUrlsParts = functions.https.onCall(
    async (data: any, context: functions.https.CallableContext): Promise<any> => {
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            printLog(COMMON_ERRORS.GENERR_NO_AUTH_USER_FOUND, LogLevel.ERROR)

        if (
            !data.bucketName ||
            !data.objectKey ||
            !data.uploadId ||
            data.numberOfParts <= 0 ||
            (context.auth?.token.participant && !data.ceremonyId)
        ) {
            const error = COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA

            printLog(
                `${error.code}: ${error.message} ${!error.details ? "" : `\ndetails: ${error.details}`}`,
                LogLevel.ERROR
            )
            throw error
        }

        // Get DB.
        const firestore = admin.firestore()

        // Get data.
        const { bucketName, objectKey, uploadId, numberOfParts, ceremonyId } = data
        const userId = context.auth?.uid

        if (context.auth?.token.participant && !!ceremonyId) {
            // Look for documents.
            const ceremonyDoc = await firestore
                .collection(commonTerms.collections.ceremonies.name)
                .doc(ceremonyId)
                .get()
            const participantDoc = await firestore
                .collection(getParticipantsCollectionPath(ceremonyId))
                .doc(userId!)
                .get()

            if (!ceremonyDoc.exists || !participantDoc.exists)
                printLog(COMMON_ERRORS.GENERR_INVALID_DOCUMENTS, LogLevel.ERROR)

            // Get data from docs.
            const ceremonyData = ceremonyDoc.data()
            const participantData = participantDoc.data()

            if (!ceremonyData || !participantData) printLog(COMMON_ERRORS.GENERR_NO_DATA, LogLevel.ERROR)

            printLog(`Ceremony document ${ceremonyDoc.id} okay`, LogLevel.DEBUG)
            printLog(`Participant document ${participantDoc.id} okay`, LogLevel.DEBUG)

            // Check participant status and contribution step.
            const { status, contributionStep } = participantData!

            if (status !== ParticipantStatus.CONTRIBUTING && contributionStep !== ParticipantContributionStep.UPLOADING)
                printLog(
                    `Participant ${participantDoc.id} is not able to start a multi part upload right now`,
                    LogLevel.ERROR
                )
        }

        // Connect w/ S3.
        const S3 = await getS3Client()

        const parts = []

        for (let i = 0; i < numberOfParts; i += 1) {
            // Prepare command for each part.
            const command = new UploadPartCommand({
                Bucket: bucketName,
                Key: objectKey,
                PartNumber: i + 1,
                UploadId: uploadId
            })

            // Get the PreSignedUrl for uploading the specific part.
            const signedUrl = await getSignedUrl(S3, command, {
                expiresIn: Number(process.env.AWS_PRESIGNED_URL_EXPIRATION!)
            })

            parts.push(signedUrl)
        }

        return parts
    }
)

/**
 * Ultimate the multi part upload for a specific object in AWS S3 bucket.
 */
export const completeMultiPartUpload = functions.https.onCall(
    async (data: any, context: functions.https.CallableContext): Promise<any> => {
        if (!context.auth || (!context.auth.token.participant && !context.auth.token.coordinator))
            printLog(COMMON_ERRORS.GENERR_NO_AUTH_USER_FOUND, LogLevel.ERROR)

        if (
            !data.bucketName ||
            !data.objectKey ||
            !data.uploadId ||
            !data.parts ||
            (context.auth?.token.participant && !data.ceremonyId)
        ) {
            const error = COMMON_ERRORS.CM_MISSING_OR_WRONG_INPUT_DATA

            printLog(
                `${error.code}: ${error.message} ${!error.details ? "" : `\ndetails: ${error.details}`}`,
                LogLevel.ERROR
            )
            throw error
        }

        // Get DB.
        const firestore = admin.firestore()

        // Get data.
        const { bucketName, objectKey, uploadId, parts, ceremonyId } = data
        const userId = context.auth?.uid

        if (context.auth?.token.participant && !!ceremonyId) {
            // Look for documents.
            const ceremonyDoc = await firestore
                .collection(commonTerms.collections.ceremonies.name)
                .doc(ceremonyId)
                .get()
            const participantDoc = await firestore
                .collection(getParticipantsCollectionPath(ceremonyId))
                .doc(userId!)
                .get()

            if (!ceremonyDoc.exists || !participantDoc.exists)
                printLog(COMMON_ERRORS.GENERR_INVALID_DOCUMENTS, LogLevel.ERROR)

            // Get data from docs.
            const ceremonyData = ceremonyDoc.data()
            const participantData = participantDoc.data()

            if (!ceremonyData || !participantData) printLog(COMMON_ERRORS.GENERR_NO_DATA, LogLevel.ERROR)

            printLog(`Ceremony document ${ceremonyDoc.id} okay`, LogLevel.DEBUG)
            printLog(`Participant document ${participantDoc.id} okay`, LogLevel.DEBUG)

            // Check participant status and contribution step.
            const { status, contributionStep } = participantData!

            if (status !== ParticipantStatus.CONTRIBUTING && contributionStep !== ParticipantContributionStep.UPLOADING)
                printLog(
                    `Participant ${participantDoc.id} is not able to start a multi part upload right now`,
                    LogLevel.ERROR
                )
        }

        // Connect w/ S3.
        const S3 = await getS3Client()

        // Prepare command.
        const command = new CompleteMultipartUploadCommand({
            Bucket: bucketName,
            Key: objectKey,
            UploadId: uploadId,
            MultipartUpload: { Parts: parts }
        })

        // Send command.
        const responseComplete = await S3.send(command)

        printLog(`Upload for ${data.uploadId} completed! Object location ${responseComplete.Location}`, LogLevel.LOG)

        return responseComplete.Location
    }
)
