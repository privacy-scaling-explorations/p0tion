import { DeleteBucketCommand, DeleteObjectCommand, S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import fs from "fs"
import {
    CeremonyDocumentReferenceAndData,
    CircuitDocumentReferenceAndData,
    ParticipantDocumentReferenceAndData
} from "../../src/types"
import { ParticipantContributionStep, ParticipantStatus, TimeoutType } from "../../src/types/enums"
import {
    commonTerms,
    getCircuitsCollectionPath,
    getContributionsCollectionPath,
    getParticipantsCollectionPath,
    getTimeoutsCollectionPath
} from "../../src"
import { generateFakeParticipant } from "../data/generators"

/**
 * Create a new S3 Client object
 * @returns <S3Client | boolean> an S3 client if the credentials are set, false otherwise
 */
const getS3Client = (): any => {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY)
        // throw new Error("Missing AWS credentials, please add them in the .env file")
        return {
            success: false,
            client: null
        }

    const s3: S3Client = new S3Client({
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
        },
        region: process.env.AWS_REGION || "us-east-1"
    })

    return {
        success: true,
        client: s3
    }
}

/**
 * Deletes an object from S3 (test function only)
 * @param bucketName <string> the name of the bucket to delete the object from
 * @param objectKey <string> the key of the object to delete
 * @returns <boolean> true if the object was deleted, false otherwise
 */
export const deleteObjectFromS3 = async (bucketName: string, objectKey: string) => {
    const s3Client = getS3Client()
    // we want to return false here so that this can be used on the emulator too (where we don't have AWS credentials)
    // as if it fails to delete it won't throw an error and affect tests. Same goes for not including the creds in the .env file
    // where it will be necessary to clean up the buckets manually
    if (!s3Client.success) return false

    const s3 = s3Client.client
    try {
        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: objectKey
        })
        const response = await s3.send(command)
        if (response.$metadata.httpStatusCode !== 200) return false
        return true
    } catch (error: any) {
        return false
    }
}

/**
 * Deletes a bucket from s3 (test function only)
 * @param bucketName <string> the name of the bucket to delete
 * @returns boolean true if the bucket was deleted, false otherwise
 */
export const deleteBucket = async (bucketName: string): Promise<boolean> => {
    const s3Client = getS3Client()
    if (!s3Client.success) return false
    const s3 = s3Client.client

    try {
        // delete a s3 bucket
        const command = new DeleteBucketCommand({
            Bucket: bucketName
        })
        const response = await s3.send(command)

        if (response.$metadata.httpStatusCode !== 200) return false
        return true
    } catch (error: any) {
        return false
    }
}

/**
 * Uploads a file to S3 (test function only)
 * @param bucketName <string> the name of the bucket to upload the file to
 * @param objectKey <string> the key of the object to upload
 * @param path <string> the path of the file to upload
 */
export const uploadFileToS3 = async (bucketName: string, objectKey: string, path: string) => {
    const s3Client = getS3Client()
    if (!s3Client.success) throw new Error("Could not upload file to S3")
    const s3 = s3Client.client

    const params = {
        Bucket: bucketName,
        Key: objectKey,
        Body: fs.createReadStream(path)
    }

    const command = new PutObjectCommand(params)

    await s3.send(command)
}

/**
 * Creates mock data on Firestore (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param ceremonyData <CeremonyDocumentReferenceAndData> the ceremony data
 * @param circuitData <CircuitDocumentReferenceAndData> the circuit data
 */
export const createMockCeremony = async (
    adminFirestore: FirebaseFirestore.Firestore,
    ceremonyData: CeremonyDocumentReferenceAndData,
    circuitData: CircuitDocumentReferenceAndData
) => {
    // Create the mock data on Firestore.
    await adminFirestore
        .collection(commonTerms.collections.ceremonies.name)
        .doc(ceremonyData.uid)
        .set({
            ...ceremonyData.data
        })

    await adminFirestore
        .collection(getCircuitsCollectionPath(ceremonyData.uid))
        .doc(circuitData.uid)
        .set({
            ...circuitData.data
        })
}

/**
 * Cleans up mock data on Firestore (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param ceremonyId <string> the ceremony id
 * @param circuitId <string> the circuit id
 */
export const cleanUpMockCeremony = async (
    adminFirestore: FirebaseFirestore.Firestore,
    ceremonyId: string,
    circuitId: string
) => {
    await adminFirestore.collection(getCircuitsCollectionPath(ceremonyId)).doc(circuitId).delete()
    await adminFirestore.collection(commonTerms.collections.ceremonies.name).doc(ceremonyId).delete()
}

/**
 * Creates a mock contribution on Firestore (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param contributorId <string> the contributor id
 * @param ceremonyId <string> the ceremony id
 * @param circuitId <string> the circuit id
 */
export const createMockContribution = async (
    adminFirestore: FirebaseFirestore.Firestore,
    ceremonyId: string,
    circuitId: string,
    contribution: any,
    contributionId: string
) => {
    await adminFirestore
        .collection(getContributionsCollectionPath(ceremonyId, circuitId))
        .doc(contributionId)
        .set({
            ...contribution.data
        })
}

/**
 * Delete a mock contribution (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param contributorId <string> the contributor id
 * @param ceremonyId <string> the ceremony id
 * @param circuitId <string> the circuit id
 */
export const cleanUpMockContribution = async (
    adminFirestore: FirebaseFirestore.Firestore,
    ceremonyId: string,
    circuitId: string,
    contributionId: string
) => {
    await adminFirestore.collection(getContributionsCollectionPath(ceremonyId, circuitId)).doc(contributionId).delete()
}

/**
 * Store a participant on Firestore (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param ceremonyId <string> the ceremony id
 */
export const createMockParticipant = async (
    adminFirestore: FirebaseFirestore.Firestore,
    ceremonyId: string,
    participantId: string,
    participantData: ParticipantDocumentReferenceAndData
) => {
    await adminFirestore
        .collection(getParticipantsCollectionPath(ceremonyId))
        .doc(participantId)
        .set({
            ...participantData.data
        })
}

/**
 * Store a participant on Firestore with contribution Done (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param ceremonyId <string> the ceremony id
 * @param participantUID <string> the participant uid
 */
export const storeMockDoneParticipant = async (
    adminFirestore: FirebaseFirestore.Firestore,
    ceremonyId: string,
    participantUID: string
) => {
    const participantDone = generateFakeParticipant({
        uid: participantUID,
        data: {
            userId: participantUID,
            contributionProgress: 1,
            contributionStep: ParticipantContributionStep.COMPLETED,
            status: ParticipantStatus.DONE,
            contributions: [
                {
                    computationTime: 1439,
                    doc: "000001",
                    hash: "Contribution Hash: 0xhash"
                }
            ],
            lastUpdated: Date.now(),
            contributionStartedAt: Date.now() - 100,
            verificationStartedAt: Date.now(),
            tempContributionData: {
                contributionComputationTime: Date.now() - 100,
                uploadId: "001",
                chunks: []
            }
        }
    })
    await createMockParticipant(adminFirestore, ceremonyId, participantUID, participantDone)
}

/**
 * Clean up the mock participant at step 1 from Firestore (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param ceremonyId <string> the ceremony id
 */
export const cleanUpMockParticipant = async (
    adminFirestore: FirebaseFirestore.Firestore,
    ceremonyId: string,
    participantId: string
) => {
    await adminFirestore.collection(getParticipantsCollectionPath(ceremonyId)).doc(participantId).delete()
}

/**
 * Creates a mock timed out contribution on Firestore (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param contributorId <string> the contributor id
 * @param ceremonyId <string> the ceremony id
 * @param circuitId <string> the circuit id
 */
export const createMockTimedOutContribution = async (
    adminFirestore: FirebaseFirestore.Firestore,
    contributorId: string,
    ceremonyId: string
) => {
    const timeoutUID = "00000001"
    await adminFirestore.collection(getParticipantsCollectionPath(ceremonyId)).doc(contributorId).set({
        contributionProgress: 1,
        contributionStartedAt: new Date().valueOf(),
        contributionStep: "DOWNLOADING",
        lastUpdated: new Date().valueOf(),
        status: "TIMEDOUT"
    })

    await adminFirestore
        .collection(getTimeoutsCollectionPath(ceremonyId, contributorId))
        .doc(timeoutUID)
        .set({
            endDate: new Date().valueOf() * 2,
            startDate: new Date().valueOf(),
            type: TimeoutType.BLOCKING_CONTRIBUTION
        })
}

/**
 * Clean up a mock timeout (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 * @param contributorId <string> the contributor id
 * @param ceremonyId <string> the ceremony id
 */
export const cleanUpMockTimeout = async (
    adminFirestore: FirebaseFirestore.Firestore,
    contributorId: string,
    ceremonyId: string
) => {
    const timeoutUID = "00000001"
    await adminFirestore.collection(getTimeoutsCollectionPath(ceremonyId, contributorId)).doc(timeoutUID).delete()
}

/// test utils
const outputLocalFolderPath = `./${commonTerms.foldersAndPathsTerms.output}`
const setupLocalFolderPath = `${outputLocalFolderPath}/${commonTerms.foldersAndPathsTerms.setup}`
const potLocalFolderPath = `${setupLocalFolderPath}/${commonTerms.foldersAndPathsTerms.pot}`
const zkeysLocalFolderPath = `${setupLocalFolderPath}/${commonTerms.foldersAndPathsTerms.zkeys}`
const contributeLocalFolderPath = `${outputLocalFolderPath}/${commonTerms.foldersAndPathsTerms.contribute}`
const contributionsLocalFolderPath = `${contributeLocalFolderPath}/${commonTerms.foldersAndPathsTerms.zkeys}`
const contributionTranscriptsLocalFolderPath = `${contributeLocalFolderPath}/${commonTerms.foldersAndPathsTerms.transcripts}`

/**
 * Get the complete PoT file path.
 * @param completeFilename <string> - the complete filename of the file (name.ext).
 * @returns <string> - the complete PoT path to the file.
 */
export const getPotLocalFilePath = (completeFilename: string): string => `${potLocalFolderPath}/${completeFilename}`

/**
 * Get the complete zKey file path.
 * @param completeFilename <string> - the complete filename of the file (name.ext).
 * @returns <string> - the complete zKey path to the file.
 */
export const getZkeyLocalFilePath = (completeFilename: string): string => `${zkeysLocalFolderPath}/${completeFilename}`

/**
 * Get the complete contribution file path.
 * @param completeFilename <string> - the complete filename of the file (name.ext).
 * @returns <string> - the complete contribution path to the file.
 */
export const getContributionLocalFilePath = (completeFilename: string): string =>
    `${contributionsLocalFolderPath}/${completeFilename}`

/**
 * Get the transcript file path.
 * @param completeFilename <string> - the complete filename of the file (name.ext).
 * @returns <string> - the the transcript path to the file.
 */
export const getTranscriptLocalFilePath = (completeFilename: string): string =>
    `${contributionTranscriptsLocalFolderPath}/${completeFilename}`
