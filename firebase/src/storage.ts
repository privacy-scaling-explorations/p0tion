import * as functions from "firebase-functions"
import {
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  PutObjectCommand
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import dotenv from "dotenv"
import { MsgType, RequestType } from "../types/index.js"
import { logMsg, GENERIC_ERRORS } from "./lib/logs.js"
import { getS3Client } from "./lib/utils.js"

dotenv.config()

/**
 * Generate a new AWS S3 pre signed url to upload/download an object (GET).
 */
export const generateGetOrPutObjectPreSignedUrl = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext): Promise<any> => {
    // Checks.
    if (!context.auth || !context.auth.token.coordinator) logMsg(GENERIC_ERRORS.GENERR_NO_COORDINATOR, MsgType.ERROR)

    if (
      !data.bucketName ||
      !data.objectKey ||
      (data.requestType !== RequestType.PUT && data.requestType !== RequestType.GET)
    )
      logMsg(GENERIC_ERRORS.GENERR_MISSING_INPUT, MsgType.ERROR)

    // Connect w/ S3.
    const S3 = await getS3Client()

    // Prepare the command.
    let command: GetObjectCommand | PutObjectCommand

    if (data.requestType === RequestType.PUT && data.contentType.length > 0)
      command = new PutObjectCommand({ Bucket: data.bucketName, Key: data.objectKey, ContentType: data.contentType })
    else command = new GetObjectCommand({ Bucket: data.bucketName, Key: data.objectKey })

    // Get the PreSignedUrl.
    const url = await getSignedUrl(S3, command, { expiresIn: Number(process.env.AWS_PRESIGNED_URL_EXPIRATION!) })

    logMsg(`(GET) Presigned URL ${url}`, MsgType.LOG)

    return url
  }
)

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
      }) // expires in seconds

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
