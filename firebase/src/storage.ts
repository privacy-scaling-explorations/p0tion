import * as functions from "firebase-functions"
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
import { MsgType } from "../types/index.js"
import { logMsg, GENERIC_ERRORS } from "./lib/logs.js"
import { getS3Client } from "./lib/utils.js"

dotenv.config()

/**
 * Create a new AWS S3 bucket for a particular ceremony.
 */
export const createBucket = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext): Promise<any> => {
    // Checks.
    if (!context.auth || !context.auth.token.coordinator) logMsg(GENERIC_ERRORS.GENERR_NO_COORDINATOR, MsgType.ERROR)

    if (!data.bucketName) logMsg(GENERIC_ERRORS.GENERR_MISSING_INPUT, MsgType.ERROR)

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
        logMsg(`Bucket successfully created`, MsgType.LOG)

        return true
      }
    } catch (error: any) {
      if (error.$metadata.httpStatusCode === 400 && error.Code === "InvalidBucketName") {
        logMsg(`Bucket not created: ${error.Code}`, MsgType.LOG)

        return false
      }

      logMsg(`Generic error when creating a new S3 bucket: ${error}`, MsgType.ERROR)
    }
  }
)

/**
 * Check if a specified object exist in a given AWS S3 bucket.
 */
export const checkIfObjectExist = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext): Promise<any> => {
    // Checks.
    if (!context.auth || !context.auth.token.coordinator) logMsg(GENERIC_ERRORS.GENERR_NO_COORDINATOR, MsgType.ERROR)

    if (!data.bucketName || !data.objectKey) logMsg(GENERIC_ERRORS.GENERR_MISSING_INPUT, MsgType.ERROR)

    // Connect w/ S3.
    const S3 = await getS3Client()

    // Prepare command.
    const command = new HeadObjectCommand({ Bucket: data.bucketName, Key: data.objectKey })

    try {
      // Send command.
      const response = await S3.send(command)

      // Check response.
      if (response.$metadata.httpStatusCode === 200 && !!response.ETag) {
        logMsg(`Object: ${data.objectKey} exists!`, MsgType.LOG)

        return true
      }
    } catch (error: any) {
      if (error.$metadata.httpStatusCode === 404 && !error.ETag) {
        logMsg(`Object: ${data.objectKey} does not exist!`, MsgType.LOG)

        return false
      }

      logMsg(`Generic error when checking for object on S3 bucket: ${error}`, MsgType.ERROR)
    }
  }
)

/**
 * Generate a new AWS S3 pre signed url to upload/download an object (GET).
 */
export const generateGetObjectPreSignedUrl = functions.https.onCall(async (data: any): Promise<any> => {
  if (!data.bucketName || !data.objectKey) logMsg(GENERIC_ERRORS.GENERR_MISSING_INPUT, MsgType.ERROR)

  // Connect w/ S3.
  const S3 = await getS3Client()

  // Prepare the command.
  const command = new GetObjectCommand({ Bucket: data.bucketName, Key: data.objectKey })

  // Get the PreSignedUrl.
  const url = await getSignedUrl(S3, command, { expiresIn: Number(process.env.AWS_PRESIGNED_URL_EXPIRATION!) })

  logMsg(`Single Pre-Signed URL ${url}`, MsgType.LOG)

  return url
})

/**
 * Initiate a multi part upload for a specific object in AWS S3 bucket.
 */
export const startMultiPartUpload = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext): Promise<any> => {
    if (!context.auth || !context.auth.token.coordinator) logMsg(GENERIC_ERRORS.GENERR_NO_COORDINATOR, MsgType.ERROR)

    if (!data.bucketName || !data.objectKey) logMsg(GENERIC_ERRORS.GENERR_MISSING_INPUT, MsgType.ERROR)

    // Connect w/ S3.
    const S3 = await getS3Client()

    // Prepare command.
    const command = new CreateMultipartUploadCommand({ Bucket: data.bucketName, Key: data.objectKey })

    // Send command.
    const responseInitiate = await S3.send(command)
    const uploadId = responseInitiate.UploadId

    logMsg(`Upload ID: ${uploadId}`, MsgType.LOG)

    return uploadId
  }
)

/**
 * Generate a PreSignedUrl for each part of the given multi part upload.
 */
export const generatePreSignedUrlsParts = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext): Promise<any> => {
    if (!context.auth || !context.auth.token.coordinator) logMsg(GENERIC_ERRORS.GENERR_NO_COORDINATOR, MsgType.ERROR)

    if (!data.bucketName || !data.objectKey || !data.uploadId || data.numberOfParts <= 0)
      logMsg(GENERIC_ERRORS.GENERR_MISSING_INPUT, MsgType.ERROR)

    // Connect w/ S3.
    const S3 = await getS3Client()

    const parts = []

    for (let i = 0; i < data.numberOfParts; i += 1) {
      // Prepare command for each part.
      const command = new UploadPartCommand({
        Bucket: data.bucketName,
        Key: data.objectKey,
        PartNumber: i + 1,
        UploadId: data.uploadId
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
    if (!context.auth || !context.auth.token.coordinator) logMsg(GENERIC_ERRORS.GENERR_NO_COORDINATOR, MsgType.ERROR)

    if (!data.bucketName || !data.objectKey || !data.uploadId || !data.parts)
      logMsg(GENERIC_ERRORS.GENERR_MISSING_INPUT, MsgType.ERROR)

    // Connect w/ S3.
    const S3 = await getS3Client()

    // Prepare command.
    const command = new CompleteMultipartUploadCommand({
      Bucket: data.bucketName,
      Key: data.objectKey,
      UploadId: data.uploadId,
      MultipartUpload: { Parts: data.parts }
    })

    // Send command.
    const responseComplete = await S3.send(command)

    logMsg(`Upload for ${data.uploadId} completed! Object location ${responseComplete.Location}`, MsgType.LOG)

    return responseComplete.Location
  }
)
