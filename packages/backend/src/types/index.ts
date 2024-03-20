import { CeremonyInputData, CircuitDocument, ETagWithPartNumber } from "@p0tion/actions"
import type { Groth16Proof, PublicSignals } from "snarkjs"

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

/**
 * Group all the necessary data needed for running the `bandadaValidateProof` cloud function.
 * @typedef {Object} BandadaValidateProof
 * @property {string} merkleTreeRoot - the merkle tree root of the group.
 * @property {string} nullifierHash - the nullifier hash of the member.
 * @property {string} externalNullifier - the external nullifier of the member.
 * @property {PackedProof} proof - the packed proof generated on the client.
 */
export type BandadaValidateProof = {
    proof: Groth16Proof
    publicSignals: PublicSignals
}

/**
 * Define the return object of the function that verifies the Bandada membership and proof.
 * @typedef {Object} VerifiedBandadaResponse
 * @property {boolean} valid - true if the proof is valid and the user is a member of the group; otherwise false.
 * @property {string} message - a message describing the result of the verification.
 * @property {string} token - the custom access token.
 */
export type VerifiedBandadaResponse = {
    valid: boolean
    message: string
    token: string
}

/**
 * Define the check nonce object for the cloud function
 * @typedef {Object} CheckNonceOfSIWEAddressRequest
 * @property {string} auth0Token - token from the device flow authentication
 */
export type CheckNonceOfSIWEAddressRequest = {
    auth0Token: string
}

/**
 * Define the check nonce response object of the cloud function
 * @typedef {Object} CheckNonceOfSIWEAddressResponse
 * @property {boolean} valid - if the checking result was valid or not
 * @property {string} message - informative message
 * @property {string} token - token to sign in
 */
export type CheckNonceOfSIWEAddressResponse = {
    valid: boolean
    message?: string
    token?: string
}
/**
 * Define the response from auth0 /userinfo endpoint
 *
 */
export type Auth0UserInfo = {
    sub: string
    nickname: string
    name: string
    picture: string
    updated_at: string
}
