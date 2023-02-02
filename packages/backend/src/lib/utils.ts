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
import {
    commonTerms,
    getTimeoutsCollectionPath,
    getParticipantsCollectionPath,
    genesisZkeyIndex
} from "@zkmpc/actions/src"
import fetch from "@adobe/node-fetch-retry"
import { GENERIC_ERRORS, logMsg } from "./logs"
import { MsgType } from "../../types/enums"

dotenv.config()

/**
 * Return the current server timestamp in milliseconds.
 * @returns <number>
 */
export const getCurrentServerTimestampInMillis = (): number => Timestamp.now().toMillis()

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
        logMsg(GENERIC_ERRORS.GENERR_WRONG_FIELD, MsgType.ERROR)

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
        logMsg(GENERIC_ERRORS.GENERR_WRONG_FIELD, MsgType.ERROR)

    return firestoreDb
        .collection(getTimeoutsCollectionPath(ceremonyId, participantId))
        .where(dateField, ">=", getCurrentServerTimestampInMillis())
        .get()
}

/**
 * Return the document belonging to a participant with a specified id (if exist).
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param participantId <string> - the unique identifier of the participant.
 * @returns <Promise<DocumentSnapshot<DocumentData>>>
 */
export const getParticipantById = async (
    ceremonyId: string,
    participantId: string
): Promise<DocumentSnapshot<DocumentData>> => {
    // Get DB.
    const firestore = admin.firestore()

    const participantDoc = await firestore
        .collection(getParticipantsCollectionPath(ceremonyId))
        .doc(participantId)
        .get()

    if (!participantDoc.exists) logMsg(GENERIC_ERRORS.GENERR_NO_PARTICIPANT, MsgType.ERROR)

    return participantDoc
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

    if (!circuitDocs) logMsg(GENERIC_ERRORS.GENERR_NO_CIRCUITS, MsgType.ERROR)

    return circuitDocs
}

/**
 * Format the next zkey index.
 * @param progress <number> - the progression in zkey index (= contributions).
 * @returns <string>
 */
export const formatZkeyIndex = (progress: number): string => {
    const initialZkeyIndex = genesisZkeyIndex

    let index = progress.toString()

    while (index.length < initialZkeyIndex.length) {
        index = `0${index}`
    }

    return index
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

    if (!filteredCircuits) logMsg(GENERIC_ERRORS.GENERR_NO_CIRCUIT, MsgType.ERROR)

    // Get the circuit (nb. there will be only one circuit w/ that position).
    const circuit = filteredCircuits.at(0)

    if (!circuit) logMsg(GENERIC_ERRORS.GENERR_NO_CIRCUIT, MsgType.ERROR)

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

    if (!contributionsDocs) logMsg(GENERIC_ERRORS.GENERR_NO_CONTRIBUTIONS, MsgType.ERROR)

    // Filter by index.
    const filteredContributions = contributionsDocs.filter(
        (contribution: admin.firestore.DocumentData) => contribution.data().zkeyIndex === "final"
    )

    if (!filteredContributions) logMsg(GENERIC_ERRORS.GENERR_NO_CONTRIBUTION, MsgType.ERROR)

    // Get the contribution (nb. there will be only one final contribution).
    const finalContribution = filteredContributions.at(0)

    if (!finalContribution) logMsg(GENERIC_ERRORS.GENERR_NO_CONTRIBUTION, MsgType.ERROR)

    return finalContribution!
}

/**
 * Return a new instance of the AWS S3 Client.
 * @returns <Promise<S3Client>
 */
export const getS3Client = async (): Promise<S3Client> => {
    if (
        !process.env.AWS_ACCESS_KEY_ID ||
        !process.env.AWS_SECRET_ACCESS_KEY ||
        !process.env.AWS_REGION ||
        !process.env.AWS_PRESIGNED_URL_EXPIRATION
    )
        logMsg(GENERIC_ERRORS.GENERR_WRONG_ENV_CONFIGURATION, MsgType.ERROR)

    // Connect w/ S3.
    return new S3Client({
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
        },
        region: process.env.AWS_REGION!
    })
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
        logMsg(`Something went wrong when downloading the file from the bucket: ${response.statusText}`, MsgType.ERROR)

    // Temporarily write the file.
    const streamPipeline = promisify(pipeline)
    await streamPipeline(response.body!, createWriteStream(tempFilePath))
}

/**
 * Sleeps the function execution for given millis.
 * @dev to be used in combination with loggers when writing data into files.
 * @param ms <number> - sleep amount in milliseconds
 * @returns <Promise<void>>
 */
export const sleep = async (ms: number): Promise<void> => setTimeout(ms)

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
        logMsg(
            `Something went wrong when uploading the transcript: ${uploadTranscriptResponse.statusText}`,
            MsgType.ERROR
        )

    logMsg(`File uploaded successfully`, MsgType.DEBUG)
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

        logMsg(`Object ${objectKey} successfully deleted: ${data.$metadata.httpStatusCode}`, MsgType.INFO)
    } catch (error: any) {
        logMsg(`Something went wrong while deleting the ${objectKey} object: ${error}`, MsgType.ERROR)
    }
}
