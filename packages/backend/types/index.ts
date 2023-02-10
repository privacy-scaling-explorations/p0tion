import { CeremonyInputData, CircuitDocument, ETagWithPartNumber } from "@zkmpc/actions/src/types"

/**
 * Group all the necessary data needed for running the `setupCeremony` cloud function.
 * @typedef {Object} SetupCeremonyData
 * @property {CeremonyInputData} ceremonyInputData - the necessary input data for setup a new ceremony.
 * @property {string} ceremonyPrefix - the ceremony prefix.
 * @property {Array<CircuitDocument>} circuits - the necessary input data for setup the related ceremony circuits.
 */
export type SetupCeremonyData = {
    ceremonyInputData: CeremonyInputData
    ceremonyPrefix: string
    circuits: Array<CircuitDocument>
}

/**
 * Group all the necessary data needed for running the `createBucket` cloud function.
 * @typedef {Object} CreateBucketData
 * @property {string} bucketName - the name of the bucket.
 */
export type CreateBucketData = {
    bucketName: string
}

/**
 * Group all the necessary data needed for running the `checkIfObjectExist` or `generateGetObjectPreSignedUrl` cloud functions.
 * @typedef {Object} BucketAndObjectKeyData
 * @property {string} bucketName - the name of the bucket.
 * @property {string} objectKey - the unique key to identify the object inside the given AWS S3 bucket.
 */
export type BucketAndObjectKeyData = {
    bucketName: string
    objectKey: string
}

/**
 * Group all the necessary data needed for running the `startMultiPartUpload` cloud function.
 * @typedef {Object} StartMultiPartUploadData
 * @property {string} bucketName - the name of the bucket.
 * @property {string} objectKey - the unique key to identify the object inside the given AWS S3 bucket.
 * @property {string} ceremonyId - the prefix of the ceremony.
 */
export type StartMultiPartUploadData = BucketAndObjectKeyData & {
    ceremonyId?: string
}

/**
 * Group all the necessary data needed for running the `generatePreSignedUrlsParts` cloud function.
 * @typedef {Object} GeneratePreSignedUrlsPartsData
 * @property {string} bucketName - the name of the bucket.
 * @property {string} objectKey - the unique key to identify the object inside the given AWS S3 bucket.
 * @property {string} uploadId - the identifier of the initiated multi-part upload.
 * @property {number} numberOfParts - the amount of chunks for which pre-signed urls are to be generated.
 * @property {string} ceremonyId - the prefix of the ceremony.
 */
export type GeneratePreSignedUrlsPartsData = BucketAndObjectKeyData & {
    uploadId: string
    numberOfParts: number
    ceremonyId?: string
}

/**
 * Group all the necessary data needed for running the `completeMultiPartUpload` cloud function.
 * @typedef {Object} GeneratePreSignedUrlsPartsData
 * @property {string} bucketName - the name of the bucket.
 * @property {string} objectKey - the unique key to identify the object inside the given AWS S3 bucket.
 * @property {string} uploadId - the identifier of the initiated multi-part upload.
 * @property {Array<ETagWithPartNumber>} parts - the chunks of the file related to the multi-part upload.
 * @property {string} ceremonyId - the prefix of the ceremony.
 */
export type CompleteMultiPartUploadData = BucketAndObjectKeyData & {
    uploadId: string
    parts: Array<ETagWithPartNumber>
    ceremonyId?: string
}
