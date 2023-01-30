import { DeleteBucketCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { fakeCeremoniesData, fakeCircuitsData } from "../data/samples"

/**
 * Deletes an object from S3 (test function only)
 * @param bucketName <string> the name of the bucket to delete the object from
 * @param objectKey <string> the key of the object to delete
 * @returns <boolean> true if the object was deleted, false otherwise
 */
export const deleteObjectFromS3 = async (bucketName: string, objectKey: string) => {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY)
        // throw new Error("Missing AWS credentials, please add them in the .env file")
        return false
    const s3 = new S3Client({
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
        },
        region: process.env.AWS_REGION || "us-east-1"
    })

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
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY)
        // throw new Error("Missing AWS credentials, please add them in the .env file")
        return false
    const s3 = new S3Client({
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
        },
        region: process.env.AWS_REGION || "us-east-1"
    })

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
 * Creates mock data on Firestore (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 */
export const createMockCeremony = async (adminFirestore: FirebaseFirestore.Firestore) => {
    // Create the mock data on Firestore.
    await adminFirestore
        .collection(`ceremonies`)
        .doc(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid)
        .set({
            ...fakeCeremoniesData.fakeCeremonyOpenedFixed.data
        })

    await adminFirestore
        .collection(`ceremonies/${fakeCeremoniesData.fakeCeremonyOpenedFixed.uid}/circuits`)
        .doc(fakeCircuitsData.fakeCircuitSmallNoContributors.uid)
        .set({
            ...fakeCircuitsData.fakeCircuitSmallNoContributors.data
        })
}

/**
 * Cleans up mock data on Firestore (test function only)
 * @param adminFirestore <FirebaseFirestore.Firestore> the admin firestore instance
 */
export const cleanUpMockCeremony = async (adminFirestore: FirebaseFirestore.Firestore) => {
    await adminFirestore
        .collection(`ceremonies/${fakeCeremoniesData.fakeCeremonyOpenedFixed.uid}/circuits`)
        .doc(fakeCircuitsData.fakeCircuitSmallNoContributors.uid)
        .delete()

    await adminFirestore.collection(`ceremonies`).doc(fakeCeremoniesData.fakeCeremonyOpenedFixed.uid).delete()
}
