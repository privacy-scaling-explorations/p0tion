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
 * @property {string} [ceremonyId] - the unique identifier of the ceremony.
 */
export type CompleteMultiPartUploadData = BucketAndObjectKeyData & {
    uploadId: string
    parts: Array<ETagWithPartNumber>
    ceremonyId?: string
}

/**
 * Group all the necessary data needed for running the `permanentlyStoreCurrentContributionTimeAndHash` cloud function.
 * @typedef {Object} PermanentlyStoreCurrentContributionTimeAndHash
 * @property {string} ceremonyId - the unique identifier of the ceremony.
 * @property {number} contributionComputationTime - the time spent by the contributor to compute the contribution.
 * @property {string} contributionHash - the hash of the contribution.
 */
export type PermanentlyStoreCurrentContributionTimeAndHash = {
    ceremonyId: string
    contributionComputationTime: number
    contributionHash: string
}

/**
 * Group all the necessary data needed for running the `temporaryStoreCurrentContributionMultiPartUploadId` cloud function.
 * @typedef {Object} TemporaryStoreCurrentContributionMultiPartUploadId
 * @property {string} ceremonyId - the unique identifier of the ceremony.
 * @property {number} uploadId - the unique identifier of the already started multi-part upload.
 */
export type TemporaryStoreCurrentContributionMultiPartUploadId = {
    ceremonyId: string
    uploadId: string
}

/**
 * Group all the necessary data needed for running the `temporaryStoreCurrentContributionUploadedChunkData` cloud function.
 * @typedef {Object} TemporaryStoreCurrentContributionUploadedChunkData
 * @property {string} ceremonyId - the unique identifier of the ceremony.
 * @property {number} uploadId - the unique identifier of the already started multi-part upload.
 */
export type TemporaryStoreCurrentContributionUploadedChunkData = {
    ceremonyId: string
    chunk: ETagWithPartNumber
}

/**
 * Group all the necessary data needed for running the `verifycontribution` cloud function.
 * @typedef {Object} VerifyContributionData
 * @property {string} ceremonyId - the unique identifier of the ceremony.
 * @property {string} circuitId - the unique identifier of the circuit.
 * @property {string} bucketName - the name of the bucket.
 * @property {string} contributorOrCoordinatorIdentifier - the identifier of the contributor or coordinator (only when finalizing).
 */
export type VerifyContributionData = {
    ceremonyId: string
    circuitId: string
    bucketName: string
    contributorOrCoordinatorIdentifier: string
}

/**
 * Group all the necessary data needed for running the `finalizeCircuit` cloud function.
 * @typedef {Object} FinalizeCircuitData
 * @property {string} ceremonyId - the unique identifier of the ceremony.
 * @property {string} circuitId - the unique identifier of the circuit.
 * @property {string} bucketName - the name of the bucket.
 * @property {string} beacon - the value used to compute the final contribution while finalizing the ceremony.
 */
export type FinalizeCircuitData = {
    ceremonyId: string
    circuitId: string
    bucketName: string
    beacon: string
}
