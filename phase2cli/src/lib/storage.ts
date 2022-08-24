import { HttpsCallable } from "firebase/functions"
import fs from "fs"
import fetch from "node-fetch"
import { ChunkWithUrl, ETagWithPartNumber } from "../../types/index.js"
import { GENERIC_ERRORS, showError } from "./errors.js"
import { readLocalJsonFile } from "./files.js"

// Get local configs.
const { config } = readLocalJsonFile("../../env.json")

/**
 * Initiate the multi part upload in AWS S3 Bucket for a large object.
 * @param cf <HttpsCallable<unknown, unknown>> - the corresponding cloud function.
 * @param bucketName <string> - the name of the AWS S3 bucket.
 * @param objectKey <string> - the identifier of the object.
 * @returns Promise<string> - the Upload ID reference.
 */
export const openMultiPartUpload = async (
  cf: HttpsCallable<unknown, unknown>,
  bucketName: string,
  objectKey: string
): Promise<string> => {
  // Call startMultiPartUpload() Cloud Function.
  const response: any = await cf({
    bucketName,
    objectKey
  })

  // Return Multi Part Upload ID.
  return response.data
}

/**
 * Get chunks and signed urls for a multi part upload.
 * @param cf <HttpsCallable<unknown, unknown>> - the corresponding cloud function.
 * @param bucketName <string> - the name of the AWS S3 bucket.
 * @param objectKey <string> - the identifier of the object.
 * @param filePath <string> - the local path where the file to be uploaded is located.
 * @param uploadId <string> - the multi part upload unique identifier.
 * @param expirationInSeconds <number> - the pre signed url expiration in seconds.
 * @returns Promise<Array, Array>
 */
export const getChunksAndPreSignedUrls = async (
  cf: HttpsCallable<unknown, unknown>,
  bucketName: string,
  objectKey: string,
  filePath: string,
  uploadId: string,
  expirationInSeconds: number
): Promise<Array<ChunkWithUrl>> => {
  // Configuration checks.
  if (!config.CONFIG_STREAM_CHUNK_SIZE_IN_MB) showError(GENERIC_ERRORS.GENERIC_NOT_CONFIGURED_PROPERLY, true)

  // Open a read stream.
  const stream = fs.createReadStream(filePath, { highWaterMark: config.CONFIG_STREAM_CHUNK_SIZE_IN_MB * 1024 * 1024 })

  // Read and store chunks.
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)

  const numberOfParts = chunks.length
  if (!numberOfParts) showError(GENERIC_ERRORS.GENERIC_FILE_ERROR, true)

  // Call generatePreSignedUrlsParts() Cloud Function.
  const response: any = await cf({
    bucketName,
    objectKey,
    uploadId,
    numberOfParts,
    expirationInSeconds
  })

  return chunks.map((val1, index) => ({
    partNumber: index + 1,
    chunk: val1,
    preSignedUrl: response.data[index]
  }))
}

/**
 * Make a PUT request to upload each part for a multi part upload.
 * @param chunksWithUrls <Array<ChunkWithUrl>> - the array containing chunks and corresponding pre signed urls.
 * @param contentType <string | false> - the content type of the file to upload.
 * @returns <Promise<Array<ETagWithPartNumber>>>
 */
export const uploadParts = async (
  chunksWithUrls: Array<ChunkWithUrl>,
  contentType: string | false
): Promise<Array<ETagWithPartNumber>> => {
  // PartNumber and ETags.
  const partNumbersAndETags = []

  for (const chunkWithUrl of chunksWithUrls) {
    // Make PUT call.
    const putResponse = await fetch(chunkWithUrl.preSignedUrl, {
      method: "PUT",
      body: chunkWithUrl.chunk,
      headers: {
        "Content-Type": contentType.toString(),
        "Content-Length": chunkWithUrl.chunk.length.toString()
      }
    })

    // Store PartNumber and ETag.
    partNumbersAndETags.push({
      ETag: putResponse.headers.get("etag"),
      PartNumber: chunkWithUrl.partNumber
    })
  }

  return partNumbersAndETags
}

/**
 * Close the multi part upload in AWS S3 Bucket for a large object.
 * @param cf <HttpsCallable<unknown, unknown>> - the corresponding cloud function.
 * @param bucketName <string> - the name of the AWS S3 bucket.
 * @param objectKey <string> - the identifier of the object.
 * @param uploadId <string> - the multi part upload unique identifier.
 * @param parts Array<ETagWithPartNumber> - the uploaded parts.
 * @returns Promise<string> - the location of the uploaded file.
 */
export const closeMultiPartUpload = async (
  cf: HttpsCallable<unknown, unknown>,
  bucketName: string,
  objectKey: string,
  uploadId: string,
  parts: Array<ETagWithPartNumber>
): Promise<string> => {
  // Call completeMultiPartUpload() Cloud Function.
  const response: any = await cf({
    bucketName,
    objectKey,
    uploadId,
    parts
  })

  // Return uploaded file location.
  return response.data
}
