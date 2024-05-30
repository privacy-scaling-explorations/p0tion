import {
    DocumentData,
    QuerySnapshot,
    DocumentSnapshot,
    QueryDocumentSnapshot,
    Timestamp,
    WhereFilterOp
} from "firebase-admin/firestore"
import admin from "firebase-admin"
import dotenv from "dotenv"
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { createWriteStream } from "node:fs"
import { pipeline } from "node:stream"
import { promisify } from "node:util"
import { readFileSync } from "fs"
import mime from "mime-types"
import { encode } from "html-entities"
import { setTimeout } from "timers/promises"
import {
    commonTerms,
    getCircuitsCollectionPath,
    getContributionsCollectionPath,
    getTimeoutsCollectionPath,
    CeremonyState,
    finalContributionIndex,
    CircuitDocument,
    COMMON_ERRORS
} from "@p0tion/actions"
import fetch from "@adobe/node-fetch-retry"
import path from "path"
import os from "os"
import { SSMClient } from "@aws-sdk/client-ssm"
import { EC2Client } from "@aws-sdk/client-ec2"
import { logAndThrowError, SPECIFIC_ERRORS } from "./errors"
import { getS3Client } from "./services"

dotenv.config()

/**
 * Get a specific document from database.
 * @dev this method differs from the one in the `actions` package because we need to use
 * the admin SDK here; therefore the Firestore instances are not interchangeable between admin
 * and user instance.
 * @param collection <string> - the name of the collection.
 * @param documentId <string> - the unique identifier of the document in the collection.
 * @returns <Promise<DocumentSnapshot<DocumentData>>> - the requested document w/ relative data.
 */
export const getDocumentById = async (
    collection: string,
    documentId: string
): Promise<DocumentSnapshot<DocumentData>> => {
    // Prepare Firestore db instance.
    const firestore = admin.firestore()

    // Get document.
    const doc = await firestore.collection(collection).doc(documentId).get()

    // Return only if doc exists; otherwise throw error.
    return doc.exists ? doc : logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT)
}

/**
 * Get the current server timestamp.
 * @dev the value is in milliseconds.
 * @returns <number> - the timestamp of the server (ms).
 */
export const getCurrentServerTimestampInMillis = (): number => Timestamp.now().toMillis()

/**
 * Interrupt the current execution for a specified amount of time.
 * @param ms <number> - the amount of time expressed in milliseconds.
 */
export const sleep = async (ms: number): Promise<void> => setTimeout(ms)

/**
 * Query for ceremony circuits.
 * @notice the order by sequence position is fundamental to maintain parallelism among contributions for different circuits.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @returns Promise<Array<FirebaseDocumentInfo>> - the ceremony' circuits documents ordered by sequence position.
 */
export const getCeremonyCircuits = async (ceremonyId: string): Promise<Array<QueryDocumentSnapshot<DocumentData>>> => {
    // Prepare Firestore db instance.
    const firestore = admin.firestore()

    // Execute query.
    const querySnap = await firestore.collection(getCircuitsCollectionPath(ceremonyId)).get()

    if (!querySnap.docs) logAndThrowError(SPECIFIC_ERRORS.SE_CONTRIBUTE_NO_CEREMONY_CIRCUITS)

    return querySnap.docs.sort(
        (a: DocumentData, b: DocumentData) => a.data().sequencePosition - b.data().sequencePosition
    )
}

/**
 * Query for ceremony circuit contributions.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param circuitId <string> - the unique identifier of the circuitId.
 * @returns Promise<Array<FirebaseDocumentInfo>> - the contributions of the ceremony circuit.
 */
export const getCeremonyCircuitContributions = async (
    ceremonyId: string,
    circuitId: string
): Promise<Array<QueryDocumentSnapshot<DocumentData>>> => {
    // Prepare Firestore db instance.
    const firestore = admin.firestore()

    // Execute query.
    const querySnap = await firestore.collection(getContributionsCollectionPath(ceremonyId, circuitId)).get()

    if (!querySnap.docs) logAndThrowError(SPECIFIC_ERRORS.SE_FINALIZE_NO_CEREMONY_CONTRIBUTIONS)

    return querySnap.docs
}

/**
 * Query not expired timeouts.
 * @notice a timeout is considered valid (aka not expired) if and only if the timeout end date
 * value is less than current timestamp.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param participantId <string> - the unique identifier of the participant.
 * @returns <Promise<QuerySnapshot<DocumentData>>>
 */
export const queryNotExpiredTimeouts = async (
    ceremonyId: string,
    participantId: string
): Promise<QuerySnapshot<DocumentData>> => {
    // Prepare Firestore db.
    const firestoreDb = admin.firestore()

    // Execute and return query result.
    return firestoreDb
        .collection(getTimeoutsCollectionPath(ceremonyId, participantId))
        .where(commonTerms.collections.timeouts.fields.endDate, ">=", getCurrentServerTimestampInMillis())
        .get()
}

/**
 * Query for opened ceremonies.
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @returns <Promise<Array<FirebaseDocumentInfo>>>
 */
export const queryOpenedCeremonies = async (): Promise<Array<QueryDocumentSnapshot<DocumentData>>> => {
    const querySnap = await admin
        .firestore()
        .collection(commonTerms.collections.ceremonies.name)
        .where(commonTerms.collections.ceremonies.fields.state, "==", CeremonyState.OPENED)
        .where(commonTerms.collections.ceremonies.fields.endDate, ">=", getCurrentServerTimestampInMillis())
        .get()

    if (!querySnap.docs) logAndThrowError(SPECIFIC_ERRORS.SE_CONTRIBUTE_NO_OPENED_CEREMONIES)

    return querySnap.docs
}

/**
 * Get ceremony circuit document by sequence position.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param sequencePosition <number> - the sequence position of the circuit.
 * @returns Promise<QueryDocumentSnapshot<DocumentData>>
 */
export const getCircuitDocumentByPosition = async (
    ceremonyId: string,
    sequencePosition: number
): Promise<QueryDocumentSnapshot<DocumentData>> => {
    // Query for all ceremony circuits.
    const circuits = await getCeremonyCircuits(ceremonyId)

    // Apply a filter using the sequence position.
    const matchedCircuits = circuits.filter(
        (circuit: DocumentData) => circuit.data().sequencePosition === sequencePosition
    )

    if (matchedCircuits.length !== 1) logAndThrowError(COMMON_ERRORS.CM_NO_CIRCUIT_FOR_GIVEN_SEQUENCE_POSITION)

    return matchedCircuits.at(0)!
}

/**
 * Create a temporary file path in the virtual memory of the cloud function.
 * @dev useful when downloading files from AWS S3 buckets for processing within cloud functions.
 * @param completeFilename <string> - the complete file name (name + ext).
 * @returns <string> - the path to the local temporary location.
 */
export const createTemporaryLocalPath = (completeFilename: string): string => path.join(os.tmpdir(), completeFilename)

/**
 * Download an artifact from the AWS S3 bucket.
 * @dev this method uses streams.
 * @param bucketName <string> - the name of the bucket.
 * @param objectKey <string> - the unique key to identify the object inside the given AWS S3 bucket.
 * @param localFilePath <string> - the local path where the file will be stored.
 */
export const downloadArtifactFromS3Bucket = async (bucketName: string, objectKey: string, localFilePath: string) => {
    // Prepare AWS S3 client instance.
    const client = await getS3Client()

    // Prepare command.
    const command = new GetObjectCommand({ Bucket: bucketName, Key: objectKey })

    // Generate a pre-signed url for downloading the file.
    const url = await getSignedUrl(client, command, { expiresIn: Number(process.env.AWS_PRESIGNED_URL_EXPIRATION) })

    // Execute download request.
    // @ts-ignore
    const response: any = await fetch(url, {
        method: "GET",
        headers: {
            "Access-Control-Allow-Origin": "*"
        }
    })

    if (response.status !== 200 || !response.ok) logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_DOWNLOAD_FAILED)

    // Write the file locally using streams.
    const writeStream = createWriteStream(localFilePath)
    const streamPipeline = promisify(pipeline)
    await streamPipeline(response.body, writeStream)

    writeStream.on("finish", () => {
        writeStream.end()
    })
}

/**
 * Upload a new artifact to the AWS S3 bucket.
 * @dev this method uses streams.
 * @param bucketName <string> - the name of the bucket.
 * @param objectKey <string> - the unique key to identify the object inside the given AWS S3 bucket.
 * @param localFilePath <string> - the local path where the file to be uploaded is stored.
 */
export const uploadFileToBucket = async (
    bucketName: string,
    objectKey: string,
    localFilePath: string,
    isPublic: boolean = false
) => {
    // Prepare AWS S3 client instance.
    const client = await getS3Client()

    // Extract content type.
    const contentType = mime.lookup(localFilePath) || ""

    // Prepare command.
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ContentType: contentType,
        ACL: isPublic ? "public-read" : "private"
    })

    // Generate a pre-signed url for uploading the file.
    const url = await getSignedUrl(client, command, { expiresIn: Number(process.env.AWS_PRESIGNED_URL_EXPIRATION) })

    // Execute upload request.
    // @ts-ignore
    const response = await fetch(url, {
        method: "PUT",
        body: readFileSync(localFilePath),
        headers: { "Content-Type": contentType }
    })

    if (response.status !== 200 || !response.ok) logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_UPLOAD_FAILED)
}

export const uploadFileToBucketNoFile = async (
    bucketName: string,
    objectKey: string,
    data: string,
    isPublic: boolean = false
) => {
    // Prepare AWS S3 client instance.
    const client = await getS3Client()

    // Prepare command.
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ContentType: "text/plain",
        ACL: isPublic ? "public-read" : "private"
    })

    // Generate a pre-signed url for uploading the file.
    const url = await getSignedUrl(client, command, { expiresIn: Number(process.env.AWS_PRESIGNED_URL_EXPIRATION) })

    // Execute upload request.
    // @ts-ignore
    const response = await fetch(url, {
        method: "PUT",
        body: data,
        headers: { "Content-Type": "text/plain" }
    })

    if (response.status !== 200 || !response.ok) logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_UPLOAD_FAILED)
}

/**
 * Upload an artifact from the AWS S3 bucket.
 * @param bucketName <string> - the name of the bucket.
 * @param objectKey <string> - the unique key to identify the object inside the given AWS S3 bucket.
 */
export const deleteObject = async (bucketName: string, objectKey: string) => {
    // Prepare AWS S3 client instance.
    const client = await getS3Client()

    // Prepare command.
    const command = new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey })

    // Execute command.
    const data = await client.send(command)

    if (data.$metadata.httpStatusCode !== 204) logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_DELETE_FAILED)
}

/**
 * Query ceremonies by state and (start/end) date value.
 * @param state <string> - the state of the ceremony.
 * @param needToCheckStartDate <boolean> - flag to discriminate when to check startDate (true) or endDate (false).
 * @param check <WhereFilerOp> - the type of filter (query check - e.g., '<' or '>').
 * @returns <Promise<admin.firestore.QuerySnapshot<admin.firestore.DocumentData>>> - the queried ceremonies after filtering operation.
 */
export const queryCeremoniesByStateAndDate = async (
    state: string,
    needToCheckStartDate: boolean,
    check: WhereFilterOp
): Promise<admin.firestore.QuerySnapshot<admin.firestore.DocumentData>> =>
    admin
        .firestore()
        .collection(commonTerms.collections.ceremonies.name)
        .where(commonTerms.collections.ceremonies.fields.state, "==", state)
        .where(
            needToCheckStartDate
                ? commonTerms.collections.ceremonies.fields.startDate
                : commonTerms.collections.ceremonies.fields.endDate,
            check,
            getCurrentServerTimestampInMillis()
        )
        .get()

/**
 * Return the document associated with the final contribution for a ceremony circuit.
 * @dev this method is useful during ceremony finalization.
 * @param ceremonyId <string> -
 * @param circuitId <string> -
 * @returns Promise<QueryDocumentSnapshot<DocumentData>> - the final contribution for the ceremony circuit.
 */
export const getFinalContribution = async (
    ceremonyId: string,
    circuitId: string
): Promise<QueryDocumentSnapshot<DocumentData>> => {
    // Get contributions for the circuit.
    const contributions = await getCeremonyCircuitContributions(ceremonyId, circuitId)

    // Match the final one.
    const matchContribution = contributions.filter(
        (contribution: DocumentData) => contribution.data().zkeyIndex === finalContributionIndex
    )

    if (!matchContribution) logAndThrowError(SPECIFIC_ERRORS.SE_FINALIZE_NO_FINAL_CONTRIBUTION)

    // Get the final contribution.
    // nb. there must be only one final contributions x circuit.
    const finalContribution = matchContribution.at(0)!

    return finalContribution
}

/**
 * Helper function to HTML encode circuit data.
 * @param circuitDocument <CircuitDocument> - the circuit document to be encoded.
 * @returns <CircuitDocument> - the circuit document encoded.
 */
export const htmlEncodeCircuitData = (circuitDocument: CircuitDocument): CircuitDocument => ({
    ...circuitDocument,
    description: encode(circuitDocument.description),
    name: encode(circuitDocument.name),
    prefix: encode(circuitDocument.prefix)
})

/**
 * Fetch the variables related to GitHub anti-sybil checks
 * @returns <any> - the GitHub variables.
 */
export const getGitHubVariables = (): any => {
    if (
        !process.env.GITHUB_MINIMUM_FOLLOWERS ||
        !process.env.GITHUB_MINIMUM_FOLLOWING ||
        !process.env.GITHUB_MINIMUM_PUBLIC_REPOS ||
        !process.env.GITHUB_MINIMUM_AGE
    )
        logAndThrowError(COMMON_ERRORS.CM_WRONG_CONFIGURATION)

    return {
        minimumFollowers: Number(process.env.GITHUB_MINIMUM_FOLLOWERS),
        minimumFollowing: Number(process.env.GITHUB_MINIMUM_FOLLOWING),
        minimumPublicRepos: Number(process.env.GITHUB_MINIMUM_PUBLIC_REPOS),
        minimumAge: Number(process.env.GITHUB_MINIMUM_AGE)
    }
}

/**
 * Fetch the variables related to EC2 verification
 * @returns <any> - the AWS EC2 variables.
 */
export const getAWSVariables = (): any => {
    if (
        !process.env.AWS_ACCESS_KEY_ID ||
        !process.env.AWS_SECRET_ACCESS_KEY ||
        !process.env.AWS_INSTANCE_PROFILE_ARN ||
        !process.env.AWS_AMI_ID ||
        !process.env.AWS_SNS_TOPIC_ARN
    )
        logAndThrowError(COMMON_ERRORS.CM_WRONG_CONFIGURATION)

    return {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        region: process.env.AWS_REGION || "eu-central-1",
        instanceProfileArn: process.env.AWS_INSTANCE_PROFILE_ARN!,
        amiId: process.env.AWS_AMI_ID!,
        snsTopic: process.env.AWS_SNS_TOPIC_ARN!
    }
}

/**
 * Create an EC2 client object
 * @returns <Promise<EC2Client>> an EC2 client
 */
export const createEC2Client = async (): Promise<EC2Client> => {
    const { accessKeyId, secretAccessKey, region } = getAWSVariables()

    const ec2: EC2Client = new EC2Client({
        credentials: {
            accessKeyId,
            secretAccessKey
        },
        region
    })

    return ec2
}

/**
 * Create an SSM client object
 * @returns <Promise<SSMClient>> an SSM client
 */
export const createSSMClient = async (): Promise<SSMClient> => {
    const { accessKeyId, secretAccessKey, region } = getAWSVariables()

    const ssm: SSMClient = new SSMClient({
        credentials: {
            accessKeyId,
            secretAccessKey
        },
        region
    })

    return ssm
}

/**
 * Get the instance id of the EC2 instance associated with the circuit
 * @param circuitId <string> - the circuit id
 * @returns <Promise<string>> - the EC2 instance id
 */
export const getEC2InstanceId = async (circuitId: string): Promise<string> => {
    const circuitDoc = await getDocumentById(commonTerms.collections.circuits.name, circuitId)

    const circuitData = circuitDoc.data()

    const { vmInstanceId } = circuitData!

    return vmInstanceId
}
