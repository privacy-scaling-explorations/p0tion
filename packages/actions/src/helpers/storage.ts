import { Functions } from "firebase/functions"
import mime from "mime-types"
import fs, { createWriteStream } from "fs"
import fetch from "@adobe/node-fetch-retry"
import https from "https"
import { GenericBar } from "cli-progress"
import { ETagWithPartNumber, ChunkWithUrl, TemporaryParticipantContributionData } from "../types/index"
import { commonTerms } from "./constants"
import {
    completeMultiPartUpload,
    generateGetObjectPreSignedUrl,
    generatePreSignedUrlsParts,
    openMultiPartUpload,
    temporaryStoreCurrentContributionMultiPartUploadId,
    temporaryStoreCurrentContributionUploadedChunkData
} from "./functions"

/**
 * Return the bucket name based on ceremony prefix.
 * @param ceremonyPrefix <string> - the ceremony prefix.
 * @param ceremonyPostfix <string> - the ceremony postfix.
 * @returns <string>
 */
export const getBucketName = (ceremonyPrefix: string, ceremonyPostfix: string): string =>
    `${ceremonyPrefix}${ceremonyPostfix}`

/**
 * Get chunks and signed urls related to an object that must be uploaded using a multi-part upload.
 * @param cloudFunctions <Functions> - the Firebase Cloud Functions service instance.
 * @param bucketName <string> - the name of the ceremony artifacts bucket (AWS S3).
 * @param objectKey <string> - the unique key to identify the object inside the given AWS S3 bucket.
 * @param localFilePath <string> - the local path where the artifact will be downloaded.
 * @param uploadId <string> - the unique identifier of the multi-part upload.
 * @param configStreamChunkSize <number> - size of each chunk into which the artifact is going to be splitted (nb. will be converted in MB).
 * @param [ceremonyId] <string> - the unique identifier of the ceremony.
 * @returns Promise<Array<ChunkWithUrl>> - the chunks with related pre-signed url.
 */
export const getChunksAndPreSignedUrls = async (
    cloudFunctions: Functions,
    bucketName: string,
    objectKey: string,
    localFilePath: string,
    uploadId: string,
    configStreamChunkSize: number,
    ceremonyId?: string
): Promise<Array<ChunkWithUrl>> => {
    // Prepare a new stream to read the file.
    const stream = fs.createReadStream(localFilePath, {
        highWaterMark: configStreamChunkSize * 1024 * 1024 // convert to MB.
    })

    // Split in chunks.
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)

    // Check if the file is not empty.
    if (!chunks.length) throw new Error("Unable to split an empty file into chunks.")

    // Request pre-signed url generation for each chunk.
    const preSignedUrls: Array<string> = await generatePreSignedUrlsParts(
        cloudFunctions,
        bucketName,
        objectKey,
        uploadId,
        chunks.length,
        ceremonyId
    )

    // Map pre-signed urls with corresponding chunks.
    return chunks.map((val1, index) => ({
        partNumber: index + 1,
        chunk: val1,
        preSignedUrl: preSignedUrls[index]
    }))
}

/**
 * Forward the request to upload each single chunk of the related ceremony artifact.
 * @param chunksWithUrls <Array<ChunkWithUrl>> - the array containing each chunk mapped with the corresponding pre-signed urls.
 * @param contentType <string | false> - the content type of the ceremony artifact.
 * @param cloudFunctions <Functions> - the Firebase Cloud Functions service instance.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param alreadyUploadedChunks Array<ETagWithPartNumber> - the temporary information about the already uploaded chunks.
 * @param logger <GenericBar> - an optional logger to show progress.
 * @returns <Promise<Array<ETagWithPartNumber>>> - the completed (uploaded) chunks information.
 */
export const uploadParts = async (
    chunksWithUrls: Array<ChunkWithUrl>,
    contentType: string | false,
    cloudFunctions?: Functions,
    ceremonyId?: string,
    alreadyUploadedChunks?: Array<ETagWithPartNumber>,
    logger?: GenericBar
): Promise<Array<ETagWithPartNumber>> => {
    // Keep track of uploaded chunks.
    const uploadedChunks: Array<ETagWithPartNumber> = alreadyUploadedChunks || []

    // if we were passed a logger, start it
    if (logger) logger.start(chunksWithUrls.length, 0)

    // Loop through remaining chunks.
    for (let i = alreadyUploadedChunks ? alreadyUploadedChunks.length : 0; i < chunksWithUrls.length; i += 1) {
        // Consume the pre-signed url to upload the chunk.
        // @ts-ignore
        const response = await fetch(chunksWithUrls[i].preSignedUrl, {
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

        // Verify the response.
        if (response.status !== 200 || !response.ok)
            throw new Error(
                `Unable to upload chunk number ${i}. Please, terminate the current session and retry to resume from the latest uploaded chunk.`
            )

        // Extract uploaded chunk data.
        const chunk = {
            ETag: response.headers.get("etag") || undefined,
            PartNumber: chunksWithUrls[i].partNumber
        }
        uploadedChunks.push(chunk)

        // Temporary store uploaded chunk data to enable later resumable contribution.
        // nb. this must be done only when contributing (not finalizing).
        if (!!ceremonyId && !!cloudFunctions)
            await temporaryStoreCurrentContributionUploadedChunkData(cloudFunctions, ceremonyId, chunk)

        // increment the count on the logger
        if (logger) logger.increment()
    }

    return uploadedChunks
}

/**
 * Upload a ceremony artifact to the corresponding bucket.
 * @notice this method implements the multi-part upload using pre-signed urls, optimal for large files.
 * Steps:
 * 0) Check if current contributor could resume a multi-part upload.
 *    0.A) If yes, continue from last uploaded chunk using the already opened multi-part upload.
 *    0.B) Otherwise, start creating a new multi-part upload.
 * 1) Generate a pre-signed url for each (remaining) chunk of the ceremony artifact.
 * 2) Consume the pre-signed urls to upload chunks.
 * 3) Complete the multi-part upload.
 * @param cloudFunctions <Functions> - the Firebase Cloud Functions service instance.
 * @param bucketName <string> - the name of the ceremony artifacts bucket (AWS S3).
 * @param objectKey <string> - the unique key to identify the object inside the given AWS S3 bucket.
 * @param localPath <string> - the local path where the artifact will be downloaded.
 * @param configStreamChunkSize <number> - size of each chunk into which the artifact is going to be splitted (nb. will be converted in MB).
 * @param [ceremonyId] <string> - the unique identifier of the ceremony (used as a double-edge sword - as identifier and as a check if current contributor is the coordinator finalizing the ceremony).
 * @param [temporaryDataToResumeMultiPartUpload] <TemporaryParticipantContributionData> - the temporary information necessary to resume an already started multi-part upload.
 * @param logger <GenericBar> - an optional logger to show progress.
 */
export const multiPartUpload = async (
    cloudFunctions: Functions,
    bucketName: string,
    objectKey: string,
    localFilePath: string,
    configStreamChunkSize: number,
    ceremonyId?: string,
    temporaryDataToResumeMultiPartUpload?: TemporaryParticipantContributionData,
    logger?: GenericBar
) => {
    // The unique identifier of the multi-part upload.
    let multiPartUploadId: string = ""
    // The list of already uploaded chunks.
    let alreadyUploadedChunks: Array<ETagWithPartNumber> = []

    // Step (0).
    if (temporaryDataToResumeMultiPartUpload && !!temporaryDataToResumeMultiPartUpload.uploadId) {
        // Step (0.A).
        multiPartUploadId = temporaryDataToResumeMultiPartUpload.uploadId
        alreadyUploadedChunks = temporaryDataToResumeMultiPartUpload.chunks
    } else {
        // Step (0.B).
        // Open a new multi-part upload for the ceremony artifact.
        multiPartUploadId = await openMultiPartUpload(cloudFunctions, bucketName, objectKey, ceremonyId)

        // Store multi-part upload identifier on document collection.
        if (ceremonyId)
            // Store Multi-Part Upload ID after generation.
            await temporaryStoreCurrentContributionMultiPartUploadId(cloudFunctions, ceremonyId!, multiPartUploadId)
    }

    // Step (1).
    const chunksWithUrlsZkey = await getChunksAndPreSignedUrls(
        cloudFunctions,
        bucketName,
        objectKey,
        localFilePath,
        multiPartUploadId,
        configStreamChunkSize,
        ceremonyId
    )

    // Step (2).
    const partNumbersAndETagsZkey = await uploadParts(
        chunksWithUrlsZkey,
        mime.lookup(localFilePath), // content-type.
        cloudFunctions,
        ceremonyId,
        alreadyUploadedChunks,
        logger
    )

    // Step (3).
    await completeMultiPartUpload(
        cloudFunctions,
        bucketName,
        objectKey,
        multiPartUploadId,
        partNumbersAndETagsZkey,
        ceremonyId
    )
}

/**
 * Download an artifact from S3 (only for authorized users)
 * @param cloudFunctions <Functions> Firebase cloud functions instance.
 * @param bucketName <string> Name of the bucket where the artifact is stored.
 * @param storagePath <string> Path to the artifact in the bucket.
 * @param localPath <string> Path to the local file where the artifact will be saved.
 */
export const downloadCeremonyArtifact = async (
    cloudFunctions: Functions,
    bucketName: string,
    storagePath: string,
    localPath: string
) => {
    // Request pre-signed url to make GET download request.
    const getPreSignedUrl = await generateGetObjectPreSignedUrl(cloudFunctions, bucketName, storagePath)

    // Make fetch to get info about the artifact.
    // @ts-ignore
    const response = await fetch(getPreSignedUrl)

    if (response.status !== 200 && !response.ok)
        throw new Error(
            `There was an erorr while downloading the object ${storagePath} from the bucket ${bucketName}. Please check the function inputs and try again.`
        )

    const content: any = response.body
    // Prepare stream.
    const writeStream = createWriteStream(localPath)

    // Write chunk by chunk.
    for await (const chunk of content) {
        // Write chunk.
        writeStream.write(chunk)
    }
}

/**
 * Get R1CS file path tied to a particular circuit of a ceremony in the storage.
 * @notice each R1CS file in the storage must be stored in the following path: `circuits/<circuitPrefix>/<completeR1csFilename>`.
 * nb. This is a rule that must be satisfied. This is NOT an optional convention.
 * @param circuitPrefix <string> - the prefix of the circuit.
 * @param completeR1csFilename <string> - the complete R1CS filename (name + ext).
 * @returns <string> - the storage path of the R1CS file.
 */
export const getR1csStorageFilePath = (circuitPrefix: string, completeR1csFilename: string): string =>
    `${commonTerms.collections.circuits.name}/${circuitPrefix}/${completeR1csFilename}`

/**
 * Get WASM file path tied to a particular circuit of a ceremony in the storage.
 * @notice each WASM file in the storage must be stored in the following path: `circuits/<circuitPrefix>/<completeWasmFilename>`.
 * nb. This is a rule that must be satisfied. This is NOT an optional convention.
 * @param circuitPrefix <string> - the prefix of the circuit.
 * @param completeWasmFilename <string> - the complete WASM filename (name + ext).
 * @returns <string> - the storage path of the WASM file.
 */
export const getWasmStorageFilePath = (circuitPrefix: string, completeWasmFilename: string): string =>
    `${commonTerms.collections.circuits.name}/${circuitPrefix}/${completeWasmFilename}`

/**
 * Get PoT file path in the storage.
 * @notice each PoT file in the storage must be stored in the following path: `pot/<completePotFilename>`.
 * nb. This is a rule that must be satisfied. This is NOT an optional convention.
 * @param completePotFilename <string> - the complete PoT filename (name + ext).
 * @returns <string> - the storage path of the PoT file.
 */
export const getPotStorageFilePath = (completePotFilename: string): string =>
    `${commonTerms.foldersAndPathsTerms.pot}/${completePotFilename}`

/**
 * Get zKey file path tied to a particular circuit of a ceremony in the storage.
 * @notice each zKey file in the storage must be stored in the following path: `circuits/<circuitPrefix>/contributions/<completeZkeyFilename>`.
 * nb. This is a rule that must be satisfied. This is NOT an optional convention.
 * @param circuitPrefix <string> - the prefix of the circuit.
 * @param completeZkeyFilename <string> - the complete zKey filename (name + ext).
 * @returns <string> - the storage path of the zKey file.
 */
export const getZkeyStorageFilePath = (circuitPrefix: string, completeZkeyFilename: string): string =>
    `${commonTerms.collections.circuits.name}/${circuitPrefix}/${commonTerms.collections.contributions.name}/${completeZkeyFilename}`

/**
 * Get verification key file path tied to a particular circuit of a ceremony in the storage.
 * @notice each verification key file in the storage must be stored in the following path: `circuits/<circuitPrefix>/<completeVerificationKeyFilename>`.
 * nb. This is a rule that must be satisfied. This is NOT an optional convention.
 * @param circuitPrefix <string> - the prefix of the circuit.
 * @param completeVerificationKeyFilename <string> - the complete verification key filename (name + ext).
 * @returns <string> - the storage path of the verification key file.
 */
export const getVerificationKeyStorageFilePath = (
    circuitPrefix: string,
    completeVerificationKeyFilename: string
): string => `${commonTerms.collections.circuits.name}/${circuitPrefix}/${completeVerificationKeyFilename}`

/**
 * Get verifier contract file path tied to a particular circuit of a ceremony in the storage.
 * @notice each verifier contract file in the storage must be stored in the following path: `circuits/<circuitPrefix>/<completeVerificationKeyFilename>`.
 * nb. This is a rule that must be satisfied. This is NOT an optional convention.
 * @param circuitPrefix <string> - the prefix of the circuit.
 * @param completeVerifierContractFilename <string> - the complete verifier contract filename (name + ext).
 * @returns <string> - the storage path of the verifier contract file.
 */
export const getVerifierContractStorageFilePath = (
    circuitPrefix: string,
    completeVerifierContractFilename: string
): string => `${commonTerms.collections.circuits.name}/${circuitPrefix}/${completeVerifierContractFilename}`

/**
 * Get transcript file path tied to a particular circuit of a ceremony in the storage.
 * @notice each R1CS file in the storage must be stored in the following path: `circuits/<circuitPrefix>/<completeTranscriptFilename>`.
 * nb. This is a rule that must be satisfied. This is NOT an optional convention.
 * @param circuitPrefix <string> - the prefix of the circuit.
 * @param completeTranscriptFilename <string> - the complete transcript filename (name + ext).
 * @returns <string> - the storage path of the transcript file.
 */
export const getTranscriptStorageFilePath = (circuitPrefix: string, completeTranscriptFilename: string): string =>
    `${commonTerms.collections.circuits.name}/${circuitPrefix}/${commonTerms.foldersAndPathsTerms.transcripts}/${completeTranscriptFilename}`
