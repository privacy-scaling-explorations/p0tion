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
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { createWriteStream } from "node:fs"
import { pipeline } from "node:stream"
import { promisify } from "node:util"
import { readFileSync } from "fs"
import mime from "mime-types"
import { setTimeout } from "timers/promises"
import { commonTerms, getCircuitsCollectionPath, getTimeoutsCollectionPath } from "@zkmpc/actions/src"
import fetch from "@adobe/node-fetch-retry"
import { CeremonyState } from "@zkmpc/actions/src/types/enums"
import { COMMON_ERRORS, logAndThrowError, printLog, SPECIFIC_ERRORS } from "./errors"
import { LogLevel } from "../../types/enums"

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
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @param ceremonyId <string> - the ceremony unique identifier.
 * @returns Promise<Array<FirebaseDocumentInfo>> - the ceremony' circuits documents ordered by sequence position.
 */
export const getCeremonyCircuits = async (ceremonyId: string): Promise<Array<QueryDocumentSnapshot<DocumentData>>> => {
    // Prepare Firestore db instance.
    const firestore = admin.firestore()

    // Execute query.
    const querySnap = await firestore.collection(getCircuitsCollectionPath(ceremonyId)).get()

    if (!querySnap.docs) logAndThrowError(SPECIFIC_ERRORS.SE_CONTRIBUTE_NO_CEREMONY_CIRCUITS)

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

    // Apply a filter using the sequence postion.
    const matchedCircuits = circuits.filter(
        (circuit: DocumentData) => circuit.data().sequencePosition === sequencePosition
    )

    if (matchedCircuits.length !== 1) logAndThrowError(COMMON_ERRORS.CM_NO_CIRCUIT_FOR_GIVEN_SEQUENCE_POSITION)

    return matchedCircuits.at(0)!
}

/// @todo needs refactoring below.

/**
 * @todo maybe deprecated
 * Query ceremonies by state and (start/end) date value.
 * @param state <string> - the value of the state to be queried.
 * @param dateField <string> - the start or end date field.
 * @param check <WhereFilerOp> - the query filter (where check).
 * @returns <Promise<admin.firestore.QuerySnapshot<admin.firestore.DocumentData>>>
 */
export const queryCeremoniesByStateAndDate = async (
    state: string,
    dateField: string,
    check: WhereFilterOp
): Promise<admin.firestore.QuerySnapshot<admin.firestore.DocumentData>> => {
    // Get DB.
    const firestoreDb = admin.firestore()

    if (
        dateField !== commonTerms.collections.ceremonies.fields.startDate &&
        dateField !== commonTerms.collections.ceremonies.fields.endDate
    )
        printLog(COMMON_ERRORS.GENERR_WRONG_FIELD, LogLevel.ERROR)

    return firestoreDb
        .collection(commonTerms.collections.ceremonies.name)
        .where(commonTerms.collections.ceremonies.fields.state, "==", state)
        .where(dateField, check, getCurrentServerTimestampInMillis())
        .get()
}

/**
 * Get the final contribution document for a specific circuit.
 * @param contributionsPath <string> - the collection path from circuit to contributions.
 * @returns Promise<admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>>
 */
export const getFinalContributionDocument = async (
    contributionsPath: string
): Promise<admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>> => {
    // Get DB.
    const firestore = admin.firestore()

    // Query for all contribution docs for circuit.
    const contributionsQuerySnap = await firestore.collection(contributionsPath).get()
    const contributionsDocs = contributionsQuerySnap.docs

    if (!contributionsDocs) printLog(COMMON_ERRORS.GENERR_NO_CONTRIBUTIONS, LogLevel.ERROR)

    // Filter by index.
    const filteredContributions = contributionsDocs.filter(
        (contribution: admin.firestore.DocumentData) => contribution.data().zkeyIndex === "final"
    )

    if (!filteredContributions) printLog(COMMON_ERRORS.GENERR_NO_CONTRIBUTION, LogLevel.ERROR)

    // Get the contribution (nb. there will be only one final contribution).
    const finalContribution = filteredContributions.at(0)

    if (!finalContribution) printLog(COMMON_ERRORS.GENERR_NO_CONTRIBUTION, LogLevel.ERROR)

    return finalContribution!
}

/**
 * Downloads and temporarily write a file from S3 bucket.
 * @param client <S3Client> - the AWS S3 client.
 * @param bucketName <string> - the name of the AWS S3 bucket.
 * @param objectKey <string> - the location of the object in the AWS S3 bucket.
 * @param tempFilePath <string> - the local path where the file will be written.
 */
export const tempDownloadFromBucket = async (
    client: S3Client,
    bucketName: string,
    objectKey: string,
    tempFilePath: string
) => {
    // Prepare get object command.
    const command = new GetObjectCommand({ Bucket: bucketName, Key: objectKey })

    // Get pre-signed url.
    const url = await getSignedUrl(client, command, { expiresIn: Number(process.env.AWS_PRESIGNED_URL_EXPIRATION!) })

    // Download the file.
    const response: any = await fetch(url, {
        method: "GET",
        headers: {
            "Access-Control-Allow-Origin": "*"
        }
    })

    if (!response.ok)
        printLog(
            `Something went wrong when downloading the file from the bucket: ${response.statusText}`,
            LogLevel.ERROR
        )

    // Temporarily write the file.
    const streamPipeline = promisify(pipeline)
    await streamPipeline(response.body!, createWriteStream(tempFilePath))
}

/**
 * Upload a file from S3 bucket.
 * @param client <S3Client> - the AWS S3 client.
 * @param bucketName <string> - the name of the AWS S3 bucket.
 * @param objectKey <string> - the location of the object in the AWS S3 bucket.
 * @param tempFilePath <string> - the local path where the file will be written.
 */
export const uploadFileToBucket = async (
    client: S3Client,
    bucketName: string,
    objectKey: string,
    tempFilePath: string
) => {
    // Get file content type.
    const contentType = mime.lookup(tempFilePath) || ""

    // Prepare command.
    const command = new PutObjectCommand({ Bucket: bucketName, Key: objectKey, ContentType: contentType })

    // Get pre-signed url.
    const url = await getSignedUrl(client, command, { expiresIn: Number(process.env.AWS_PRESIGNED_URL_EXPIRATION!) })

    // Make upload request (PUT).
    const uploadTranscriptResponse = await fetch(url, {
        method: "PUT",
        body: readFileSync(tempFilePath),
        headers: { "Content-Type": contentType }
    })

    // Check response.
    if (!uploadTranscriptResponse.ok)
        printLog(
            `Something went wrong when uploading the transcript: ${uploadTranscriptResponse.statusText}`,
            LogLevel.ERROR
        )

    printLog(`File uploaded successfully`, LogLevel.DEBUG)
}

/**
 * Delete a file from S3 bucket.
 * @param client <S3Client> - the AWS S3 client.
 * @param bucketName <string> - the name of the AWS S3 bucket.
 * @param objectKey <string> - the location of the object in the AWS S3 bucket.
 */
export const deleteObject = async (client: S3Client, bucketName: string, objectKey: string) => {
    try {
        // Prepare command.
        const command = new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey })

        // Send command.
        const data = await client.send(command)

        printLog(`Object ${objectKey} successfully deleted: ${data.$metadata.httpStatusCode}`, LogLevel.INFO)
    } catch (error: any) {
        printLog(`Something went wrong while deleting the ${objectKey} object: ${error}`, LogLevel.ERROR)
    }
}
