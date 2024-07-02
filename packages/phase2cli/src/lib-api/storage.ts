import { GenericBar } from "cli-progress"
import {
    ChunkWithUrl,
    ETagWithPartNumber,
    TemporaryParticipantContributionData,
    generatePreSignedUrlsPartsAPI,
    openMultiPartUploadAPI,
    temporaryStoreCurrentContributionMultiPartUploadIdAPI,
    temporaryStoreCurrentContributionUploadedChunkDataAPI,
    completeMultiPartUploadAPI
} from "@p0tion/actions"
import mime from "mime-types"
import https from "https"
import fs from "fs"
import * as fetchretry from "@adobe/node-fetch-retry" // Replace 'import fetch as fetchretry' with 'import * as fetchretry'

import theme from "../lib/theme.js"
import { customSpinner } from "../lib/utils.js"

export const getChunksAndPreSignedUrls = async (
    objectKey: string,
    localFilePath: string,
    uploadId: string,
    configStreamChunkSize: number,
    token: string,
    ceremonyId?: number
) => {
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
    const { parts: preSignedUrls } = await generatePreSignedUrlsPartsAPI(
        objectKey,
        uploadId,
        chunks.length,
        ceremonyId,
        token
    )

    // Map pre-signed urls with corresponding chunks.
    return chunks.map((val1, index) => ({
        partNumber: index + 1,
        chunk: val1,
        preSignedUrl: preSignedUrls[index]
    }))
}

export const uploadParts = async (
    chunksWithUrls: Array<ChunkWithUrl>,
    contentType: string | false,
    token: string,
    creatingCeremony: boolean,
    ceremonyId?: number,
    alreadyUploadedChunks?: Array<ETagWithPartNumber>,
    logger?: GenericBar
) => {
    // Keep track of uploaded chunks.
    const uploadedChunks: Array<ETagWithPartNumber> = alreadyUploadedChunks || []

    // if we were passed a logger, start it
    if (logger) logger.start(chunksWithUrls.length, 0)

    // Loop through remaining chunks.
    for (let i = alreadyUploadedChunks ? alreadyUploadedChunks.length : 0; i < chunksWithUrls.length; i += 1) {
        // Consume the pre-signed url to upload the chunk.
        // @ts-ignore
        const response = await fetchretry.default(chunksWithUrls[i].preSignedUrl, {
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
        if (ceremonyId && !creatingCeremony)
            await temporaryStoreCurrentContributionUploadedChunkDataAPI(ceremonyId, token, chunk)

        // increment the count on the logger
        if (logger) logger.increment()
    }

    return uploadedChunks
}

export const multiPartUpload = async (
    ceremonyId: number,
    objectKey: string,
    localFilePath: string,
    configStreamChunkSize: number,
    token: string,
    creatingCeremony?: boolean,
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
        const { uploadId } = await openMultiPartUploadAPI(objectKey, ceremonyId, token)
        multiPartUploadId = uploadId

        // Store multi-part upload identifier on document collection.
        if (ceremonyId)
            // Store Multi-Part Upload ID after generation.
            await temporaryStoreCurrentContributionMultiPartUploadIdAPI(ceremonyId!, multiPartUploadId, token)
    }

    // Step (1).
    const chunksWithUrlsZkey = await getChunksAndPreSignedUrls(
        objectKey,
        localFilePath,
        multiPartUploadId,
        configStreamChunkSize,
        token,
        ceremonyId
    )
    // Step (2).
    const partNumbersAndETagsZkey = await uploadParts(
        chunksWithUrlsZkey,
        mime.lookup(localFilePath), // content-type.
        token,
        creatingCeremony,
        ceremonyId,
        alreadyUploadedChunks,
        logger
    )

    // Step (3).
    await completeMultiPartUploadAPI(ceremonyId, token, objectKey, multiPartUploadId, partNumbersAndETagsZkey)
}

export const handleCircuitArtifactUploadToStorage = async (
    storageFilePath: string,
    ceremonyId: number,
    localPathAndFileName: string,
    completeFilename: string,
    token: string,
    creatingCeremony?: boolean
) => {
    const spinner = customSpinner(`Uploading ${theme.text.bold(completeFilename)} file to ceremony storage...`, `clock`)
    spinner.start()

    await multiPartUpload(
        ceremonyId,
        storageFilePath,
        localPathAndFileName,
        Number(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB),
        token,
        creatingCeremony
    )

    spinner.succeed(`Upload of (${theme.text.bold(completeFilename)}) file completed successfully`)
}
