import { DocumentData, DocumentSnapshot, Timestamp, WhereFilterOp } from "firebase-admin/firestore"
import admin from "firebase-admin"
import * as functions from "firebase-functions"
import dotenv from "dotenv"
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { createWriteStream } from "node:fs"
import { pipeline } from "node:stream"
import { promisify } from "node:util"
import { readFileSync } from "fs"
import mime from "mime-types"
import { setTimeout } from "timers/promises"
import { commonTerms, getTimeoutsCollectionPath } from "@zkmpc/actions/src"
import fetch from "@adobe/node-fetch-retry"
import { COMMON_ERRORS, logAndThrowError, printLog } from "./errors"
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

/// @todo to be refactored.

/**
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
 * Query timeouts by (start/end) date value.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param participantId <string> - the unique identifier of the participant.
 * @param dateField <string> - the name of the date field.
 * @returns <Promise<admin.firestore.QuerySnapshot<admin.firestore.DocumentData>>>
 */
export const queryValidTimeoutsByDate = async (
    ceremonyId: string,
    participantId: string,
    dateField: string
): Promise<admin.firestore.QuerySnapshot<admin.firestore.DocumentData>> => {
    // Get DB.
    const firestoreDb = admin.firestore()

    if (
        dateField !== commonTerms.collections.timeouts.fields.startDate &&
        dateField !== commonTerms.collections.timeouts.fields.endDate
    )
        printLog(COMMON_ERRORS.GENERR_WRONG_FIELD, LogLevel.ERROR)

    return firestoreDb
        .collection(getTimeoutsCollectionPath(ceremonyId, participantId))
        .where(dateField, ">=", getCurrentServerTimestampInMillis())
        .get()
}

/**
 * Return all circuits for a given ceremony (if any).
 * @param circuitsPath <string> - the collection path from ceremonies to circuits.
 * @returns Promise<Array<admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>>>
 */
export const getCeremonyCircuits = async (
    circuitsPath: string
): Promise<Array<admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>>> => {
    // Get DB.
    const firestore = admin.firestore()

    // Query for all docs.
    const circuitsQuerySnap = await firestore.collection(circuitsPath).get()
    const circuitDocs = circuitsQuerySnap.docs

    if (!circuitDocs) printLog(COMMON_ERRORS.GENERR_NO_CIRCUITS, LogLevel.ERROR)

    return circuitDocs
}

/**
 * Get the document for the circuit of the ceremony with a given sequence position.
 * @param circuitsPath <string> - the collection path from ceremonies to circuits.
 * @param position <number> - the sequence position of the circuit.
 * @returns Promise<admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>>
 */
export const getCircuitDocumentByPosition = async (
    circuitsPath: string,
    position: number
): Promise<admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>> => {
    // Query for all circuit docs.
    const circuitDocs = await getCeremonyCircuits(circuitsPath)

    // Filter by position.
    const filteredCircuits = circuitDocs.filter(
        (circuit: admin.firestore.DocumentData) => circuit.data().sequencePosition === position
    )

    if (!filteredCircuits) printLog(COMMON_ERRORS.GENERR_NO_CIRCUIT, LogLevel.ERROR)

    // Get the circuit (nb. there will be only one circuit w/ that position).
    const circuit = filteredCircuits.at(0)

    if (!circuit) printLog(COMMON_ERRORS.GENERR_NO_CIRCUIT, LogLevel.ERROR)

    functions.logger.info(`Circuit w/ UID ${circuit?.id} at position ${position}`)

    return circuit!
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
