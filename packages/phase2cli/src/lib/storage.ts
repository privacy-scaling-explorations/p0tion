import { Functions, HttpsCallable } from "firebase/functions"
import fs from "fs"
import fetch from "@adobe/node-fetch-retry"
import { createWriteStream } from "node:fs"
import https from "https"
import dotenv from "dotenv"
import { SingleBar, Presets } from "cli-progress"
import { ChunkWithUrl, ETagWithPartNumber, ProgressBarType } from "../../types/index"
import { GENERIC_ERRORS, showError } from "./errors"
import { emojis, theme } from "./constants"
import { generateGetObjectPreSignedUrl } from "@zkmpc/actions"

dotenv.config()

/**
 * Return a custom progress bar.
 * @param type <ProgressBarType> - the type of the progress bar.
 * @returns <SingleBar> - a new custom (single) progress bar.
 */
export const customProgressBar = (type: ProgressBarType): SingleBar => {
    // Formats.
    const uploadFormat = `${emojis.arrowUp}  Uploading [${theme.magenta(
        "{bar}"
    )}] {percentage}% | {value}/{total} Chunks`
    const downloadFormat = `${emojis.arrowDown}  Downloading [${theme.magenta(
        "{bar}"
    )}] {percentage}% | {value}/{total} GB`

    // Define a progress bar showing percentage of completion and chunks downloaded/uploaded.
    return new SingleBar(
        {
            format: type === ProgressBarType.DOWNLOAD ? downloadFormat : uploadFormat,
            hideCursor: true,
            clearOnComplete: true
        },
        Presets.legacy
    )
}

/**
 * Convert bytes or chilobytes into gigabytes with customizable precision.
 * @param bytesOrKB <number> - bytes or KB to be converted.
 * @param isBytes <boolean> - true if the input is in bytes; otherwise false for KB input.
 * @returns <number>
 */
export const convertToGB = (bytesOrKB: number, isBytes: boolean): number =>
    Number(bytesOrKB / 1024 ** (isBytes ? 3 : 2))


/**
 * Initiate the multi part upload in AWS S3 Bucket for a large object.
 * @param cf <HttpsCallable<unknown, unknown>> - the corresponding cloud function.
 * @param bucketName <string> - the name of the AWS S3 bucket.
 * @param objectKey <string> - the identifier of the object.
 * @param ceremonyId <string> - the identifier of the ceremony.
 * @returns Promise<string> - the Upload ID reference.
 */
export const openMultiPartUpload = async (
    cf: HttpsCallable<unknown, unknown>,
    bucketName: string,
    objectKey: string,
    ceremonyId?: string
): Promise<string> => {
    // Call startMultiPartUpload() Cloud Function.
    const response: any = await cf({
        bucketName,
        objectKey,
        ceremonyId
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
 * @param ceremonyId <string> - the identifier of the ceremony.
 * @returns Promise<Array, Array>
 */
export const getChunksAndPreSignedUrls = async (
    cf: HttpsCallable<unknown, unknown>,
    bucketName: string,
    objectKey: string,
    filePath: string,
    uploadId: string,
    expirationInSeconds: number,
    ceremonyId?: string
): Promise<Array<ChunkWithUrl>> => {
    // Configuration checks.
    if (!process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB) showError(GENERIC_ERRORS.GENERIC_NOT_CONFIGURED_PROPERLY, true)

    // Open a read stream.
    const stream = fs.createReadStream(filePath, {
        highWaterMark: Number(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB) * 1024 * 1024
    })

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
        expirationInSeconds,
        ceremonyId
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
 * @param cf <HttpsCallable<unknown, unknown>> - the CF for enable resumable upload from last chunk by temporarily store the ETags and PartNumbers of already uploaded chunks.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param alreadyUploadedChunks <any> - the ETag and PartNumber temporary information about the already uploaded chunks.
 * @returns <Promise<Array<ETagWithPartNumber>>>
 */
export const uploadParts = async (
    chunksWithUrls: Array<ChunkWithUrl>,
    contentType: string | false,
    cf?: HttpsCallable<unknown, unknown>,
    ceremonyId?: string,
    alreadyUploadedChunks?: any
): Promise<Array<ETagWithPartNumber>> => {
    // PartNumber and ETags.
    let partNumbersAndETags = []

    // Restore the already uploaded chunks in the same order.
    if (alreadyUploadedChunks) partNumbersAndETags = alreadyUploadedChunks

    // Resume from last uploaded chunk (0 for new multi-part upload).
    const lastChunkIndex = partNumbersAndETags.length

    // Define a custom progress bar starting from last updated chunk.
    const progressBar = customProgressBar(ProgressBarType.UPLOAD)
    progressBar.start(chunksWithUrls.length, lastChunkIndex)

    for (let i = lastChunkIndex; i < chunksWithUrls.length; i += 1) {
        // Make PUT call.
        const putResponse = await fetch(chunksWithUrls[i].preSignedUrl, {
            retryOptions: {
                retryInitialDelay: 500, // 500 ms.
                socketTimeout: 60000, // 60 seconds.
                retryMaxDuration: 300000 // 5 minutes.
            },
            method: "PUT",
            body: chunksWithUrls[i].chunk,
            headers: {
                "Content-Type": contentType.toString(),
                "Content-Length": chunksWithUrls[i].chunk.length.toString()
            },
            agent: new https.Agent({ keepAlive: true })
        })

        // Extract data.
        const eTag = putResponse.headers.get("etag")
        const { partNumber } = chunksWithUrls[i]

        // Store PartNumber and ETag.
        partNumbersAndETags.push({
            ETag: eTag,
            PartNumber: partNumber
        })

        // nb. to be done only when contributing.
        if (!!ceremonyId && !!cf)
            // Call CF to temporary store the chunks ETag and PartNumber info (useful for resumable upload).
            await cf({
                ceremonyId,
                eTag,
                partNumber
            })

        // Increment the progress bar.
        progressBar.increment(1)
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
 * @param ceremonyId <string> - the identifier of the ceremony.
 * @returns Promise<string> - the location of the uploaded file.
 */
export const closeMultiPartUpload = async (
    cf: HttpsCallable<unknown, unknown>,
    bucketName: string,
    objectKey: string,
    uploadId: string,
    parts: Array<ETagWithPartNumber>,
    ceremonyId?: string
): Promise<string> => {
    // Call completeMultiPartUpload() Cloud Function.
    const response: any = await cf({
        bucketName,
        objectKey,
        uploadId,
        parts,
        ceremonyId
    })

    // Return uploaded file location.
    return response.data
}

/**
 * Download locally a specified file from the given bucket.
 * @param firebaseFunctions <Functions> - the firebase cloud functions.
 * @param bucketName <string> - the name of the AWS S3 bucket.
 * @param objectKey <string> - the identifier of the object (storage path).
 * @param localPath <string> - the path where the file will be written.
 * @return <Promise<void>>
 */
export const downloadLocalFileFromBucket = async (
    firebaseFunctions: Functions,
    bucketName: string,
    objectKey: string,
    localPath: string
): Promise<void> => {
    // Call generateGetObjectPreSignedUrl() Cloud Function.
    const response = await generateGetObjectPreSignedUrl(firebaseFunctions, bucketName, objectKey)

    // Get the pre-signed url.
    const preSignedUrl = response.data

    // Get request.
    const getResponse = await fetch(preSignedUrl)

    if (!getResponse.ok) showError(`${GENERIC_ERRORS.GENERIC_FILE_ERROR} - ${getResponse.statusText}`, true)

    const contentLength = Number(getResponse.headers.get(`content-length`))
    const contentLengthInGB = convertToGB(contentLength, true)

    // Create a new write stream.
    const writeStream = createWriteStream(localPath)

    // Define a custom progress bar starting from last updated chunk.
    const progressBar = customProgressBar(ProgressBarType.DOWNLOAD)

    // Progress bar step size.
    const progressBarStepSize = contentLengthInGB / 100

    let writtenData = 0
    let nextStepSize = progressBarStepSize

    // Init the progress bar.
    progressBar.start(contentLengthInGB < 0.01 ? 0.01 : Number(contentLengthInGB.toFixed(2)), 0)

    // Write chunk by chunk.
    for await (const chunk of getResponse.body) {
        // Write.
        writeStream.write(chunk)

        // Update.
        writtenData += chunk.length

        // Check if the progress bar must advance.
        while (convertToGB(writtenData, true) >= nextStepSize) {
            // Update.
            nextStepSize += progressBarStepSize

            // Increment bar.
            progressBar.update(contentLengthInGB < 0.01 ? 0.01 : parseFloat(nextStepSize.toFixed(2)).valueOf())
        }
    }

    progressBar.stop()
}
