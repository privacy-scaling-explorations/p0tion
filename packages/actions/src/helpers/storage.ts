import { Functions, httpsCallable } from "firebase/functions"
import mime from "mime-types"
import fs, { readFileSync } from "fs"
import fetch from "@adobe/node-fetch-retry"
import https from "https"
import { FirebaseStorage, ref, uploadBytes, UploadResult } from "firebase/storage"
import { ETagWithPartNumber, ChunkWithUrl } from "../../types"
import {
    temporaryStoreCurrentContributionMultiPartUploadId,
    temporaryStoreCurrentContributionUploadedChunkData
} from "../core/contribute"

/**
 * Return the bucket name based on ceremony prefix.
 * @param ceremonyPrefix <string> - the ceremony prefix.
 * @param ceremonyPostfix <string> - the ceremony postfix.
 * @returns <string>
 */
export const getBucketName = (ceremonyPrefix: string, ceremonyPostfix: string): string =>
    `${ceremonyPrefix}${ceremonyPostfix}`

/**
 * Creates a new S3 bucket for a ceremony
 * @param functions <Functions> - the cloud functions.
 * @param bucketName <string> - the bucket name for the new bucket
 * @returns <boolean>
 */
export const createS3Bucket = async (functions: Functions, bucketName: string): Promise<boolean> => {
    const cf = httpsCallable(functions, "createBucket")
    // Call createBucket() Cloud Function.
    const response: any = await cf({
        bucketName
    })

    // Return true if exists, otherwise false.
    return response.data
}

/**
 * Check if an object exists in a given AWS S3 bucket.
 * @param functions <Functions> - the cloud functions.
 * @param bucketName <string> - the name of the AWS S3 bucket.
 * @param objectKey <string> - the identifier of the object.
 * @returns Promise<string> - true if the object exists, otherwise false.
 */
export const objectExist = async (functions: Functions, bucketName: string, objectKey: string): Promise<boolean> => {
    const cf = httpsCallable(functions, "checkIfObjectExist")
    // Call checkIfObjectExist() Cloud Function.
    const response: any = await cf({
        bucketName,
        objectKey
    })

    // Return true if exists, otherwise false.
    return response.data
}

/**
 * Initiate the multi part upload in AWS S3 Bucket for a large object.
 * @param functions <Functions> - the cloud functions.
 * @param bucketName <string> - the name of the AWS S3 bucket.
 * @param objectKey <string> - the identifier of the object.
 * @param ceremonyId <string> - the identifier of the ceremony.
 * @returns Promise<string> - the Upload ID reference.
 */
const openMultiPartUpload = async (
    functions: Functions,
    bucketName: string,
    objectKey: string,
    ceremonyId?: string
): Promise<string> => {
    // Call startMultiPartUpload() Cloud Function.
    const cf = httpsCallable(functions, "startMultiPartUpload")
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
 * @param functions <Functions> - the cloud functions.
 * @param bucketName <string> - the name of the AWS S3 bucket.
 * @param objectKey <string> - the identifier of the object.
 * @param filePath <string> - the local path where the file to be uploaded is located.
 * @param uploadId <string> - the multi part upload unique identifier.
 * @param expirationInSeconds <number> - the pre signed url expiration in seconds.
 * @param configStreamChunkSize <string> - the chunk size used for multi part upload (in MB).
 * @param ceremonyId <string> - the identifier of the ceremony.
 * @returns Promise<Array, ChunkWithUrl>
 */
const getChunksAndPreSignedUrls = async (
    functions: Functions,
    bucketName: string,
    objectKey: string,
    filePath: string,
    uploadId: string,
    expirationInSeconds: number,
    configStreamChunkSize: string,
    ceremonyId?: string
): Promise<Array<ChunkWithUrl>> => {
    // Open a read stream.
    const stream = fs.createReadStream(filePath, {
        highWaterMark: Number(configStreamChunkSize) * 1024 * 1024
    })

    // Read and store chunks.
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)

    const numberOfParts = chunks.length
    if (!numberOfParts) throw new Error("Storage-003: File not found")

    // Call generatePreSignedUrlsParts() Cloud Function.
    const cf = httpsCallable(functions, "generatePreSignedUrlsParts")
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
 * @param functions Functions - the cloud functions.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param alreadyUploadedChunks <any> - the ETag and PartNumber temporary information about the already uploaded chunks.
 * @returns <Promise<Array<ETagWithPartNumber>>>
 */
const uploadParts = async (
    chunksWithUrls: Array<ChunkWithUrl>,
    contentType: string | false,
    functions?: Functions,
    ceremonyId?: string,
    alreadyUploadedChunks?: any
): Promise<Array<ETagWithPartNumber>> => {
    // PartNumber and ETags.
    let partNumbersAndETags = []

    // Restore the already uploaded chunks in the same order.
    if (alreadyUploadedChunks) partNumbersAndETags = alreadyUploadedChunks

    // Resume from last uploaded chunk (0 for new multi-part upload).
    const lastChunkIndex = partNumbersAndETags.length

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
        if (!!ceremonyId && !!functions)
            // Call CF to temporary store the chunks ETag and PartNumber info (useful for resumable upload).
            await temporaryStoreCurrentContributionUploadedChunkData(functions, ceremonyId, eTag!, partNumber)
    }

    return partNumbersAndETags
}

/**
 * Close the multi part upload in AWS S3 Bucket for a large object.
 * @param functions <Functions> - the cloud functions.
 * @param bucketName <string> - the name of the AWS S3 bucket.
 * @param objectKey <string> - the identifier of the object.
 * @param uploadId <string> - the multi part upload unique identifier.
 * @param parts Array<ETagWithPartNumber> - the uploaded parts.
 * @param ceremonyId <string> - the identifier of the ceremony.
 * @returns Promise<string> - the location of the uploaded file.
 */
const closeMultiPartUpload = async (
    functions: Functions,
    bucketName: string,
    objectKey: string,
    uploadId: string,
    parts: Array<ETagWithPartNumber>,
    ceremonyId?: string
): Promise<string> => {
    // Call completeMultiPartUpload() Cloud Function.
    const cf = httpsCallable(functions, "completeMultiPartUpload")
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
 * Upload a file by subdividing it in chunks to AWS S3 bucket.
 * @param functions <Functions> - the firebase functions.
 * @param bucketName <string> - the name of the AWS S3 bucket.
 * @param objectKey <string> - the path of the object inside the AWS S3 bucket.
 * @param localPath <string> - the local path of the file to be uploaded.
 * @param configStreamChunkSize <string> - the chunk size used for multi part upload (in MB).
 * @param presignedUrlExpiration <number> - the expiration for the pre-signed url.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param tempContributionData <any> - the temporary information necessary to resume an already started multi-part upload.
 */
export const multiPartUpload = async (
    functions: Functions,
    bucketName: string,
    objectKey: string,
    localPath: string,
    configStreamChunkSize: string,
    presignedUrlExpiration: number,
    ceremonyId?: string,
    tempContributionData?: any
): Promise<boolean> => {
    // Get content type.
    const contentType = mime.lookup(localPath)

    // The Multi-Part Upload unique identifier.
    let uploadIdZkey = ""
    // Already uploaded chunks temp info (nb. useful only when resuming).
    let alreadyUploadedChunks = []

    // Check if the contributor can resume an already started multi-part upload.
    if (!tempContributionData || (!!tempContributionData && !tempContributionData.uploadId)) {
        // Start from scratch.
        uploadIdZkey = await openMultiPartUpload(functions, bucketName, objectKey, ceremonyId)

        // Must be done only when contributing.
        if (ceremonyId)
            // Store Multi-Part Upload ID after generation.
            await temporaryStoreCurrentContributionMultiPartUploadId(functions, ceremonyId!, uploadIdZkey)
    } else {
        // Read temp info from Firestore.
        uploadIdZkey = tempContributionData.uploadId
        alreadyUploadedChunks = tempContributionData.chunks
    }

    const chunksWithUrlsZkey = await getChunksAndPreSignedUrls(
        functions,
        bucketName,
        objectKey,
        localPath,
        uploadIdZkey,
        Number(presignedUrlExpiration),
        configStreamChunkSize,
        ceremonyId
    )

    // Step 3
    const partNumbersAndETagsZkey = await uploadParts(
        chunksWithUrlsZkey,
        contentType,
        functions,
        ceremonyId,
        alreadyUploadedChunks
    )

    await closeMultiPartUpload(functions, bucketName, objectKey, uploadIdZkey, partNumbersAndETagsZkey, ceremonyId)

    return true
}

/**
 * Calls the generateGetObjectPreSignedUrl cloud function
 * @param functions <Functions> - the cloud functions
 * @param bucketName <string> - the bucket name
 * @param objectKey <string> - the file name
 * @returns <Promise<any>>
 */
export const generateGetObjectPreSignedUrl = async (
    functions: Functions,
    bucketName: string,
    objectKey: string
): Promise<any> => {
    const cf = httpsCallable(functions, "generateGetObjectPreSignedUrl")
    const { data } = await cf({
        bucketName,
        objectKey
    })

    return data
}

/**
 * Upload a file to storage.
 * @param localPath <string> - path where the file is locally stored.
 * @param storagePath <string> - path where the file will be stored in the storage service.
 * @returns <Promise<any>>
 */
export const uploadFileToStorage = async (
    firebaseStorage: FirebaseStorage,
    localPath: string,
    storagePath: string
): Promise<UploadResult> => {
    // Create a reference with folder path.
    const pathReference = ref(firebaseStorage, storagePath)

    return uploadBytes(pathReference, readFileSync(localPath))
}
