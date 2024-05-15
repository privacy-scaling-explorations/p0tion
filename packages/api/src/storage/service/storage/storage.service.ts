import {
    CreateBucketCommand,
    //CreateMultipartUploadCommand,
    HeadBucketCommand,
    PutBucketCorsCommand,
    PutPublicAccessBlockCommand
} from "@aws-sdk/client-s3"
import { Injectable } from "@nestjs/common"
import {
    /*ParticipantContributionStep,
    ParticipantStatus,
    commonTerms,
    formatZkeyIndex,*/
    getBucketName
    //getZkeyStorageFilePath
} from "@p0tion/actions"
import { COMMON_ERRORS, SPECIFIC_ERRORS, logAndThrowError, makeError, printLog } from "src/lib/errors"
import { getS3Client } from "src/lib/services"
import { StartMultiPartUploadDataDto } from "src/storage/dto/storage-dto"
import { LogLevel } from "src/types/enums"

@Injectable()
export class StorageService {
    /**
     * Check if the pre-condition for interacting w/ a multi-part upload for an identified current contributor is valid.
     * @notice the precondition is be a current contributor (contributing status) in the uploading contribution step.
     * @param contributorId <string> - the unique identifier of the contributor.
     * @param ceremonyId <string> - the unique identifier of the ceremony.
     */
    /*async checkPreConditionForCurrentContributorToInteractWithMultiPartUpload(
        contributorId: string,
        ceremonyId: string
    ) {
        // Get ceremony and participant documents.
        const ceremonyDoc = await getDocumentById(commonTerms.collections.ceremonies.name, ceremonyId)
        const participantDoc = await getDocumentById(getParticipantsCollectionPath(ceremonyId), contributorId!)

        // Get data from docs.
        const ceremonyData = ceremonyDoc.data()
        const participantData = participantDoc.data()

        if (!ceremonyData || !participantData) logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

        // Check pre-condition to start multi-part upload for a current contributor.
        const { status, contributionStep } = participantData!

        if (status !== ParticipantStatus.CONTRIBUTING && contributionStep !== ParticipantContributionStep.UPLOADING)
            logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_CANNOT_INTERACT_WITH_MULTI_PART_UPLOAD)
    }*/

    /**
     * Helper function that confirms whether a bucket is used for a ceremony.
     * @dev this helps to prevent unauthorized access to coordinator's buckets.
     * @param bucketName
     */
    /*async checkIfBucketIsDedicatedToCeremony(bucketName: string) {
        // Get Firestore DB.
        const firestoreDatabase = admin.firestore()

        // Extract ceremony prefix from bucket name.
        const ceremonyPrefix = bucketName.replace(String(process.env.AWS_CEREMONY_BUCKET_POSTFIX), "")

        // Query the collection.
        const ceremonyCollection = await firestoreDatabase
            .collection(commonTerms.collections.ceremonies.name)
            .where(commonTerms.collections.ceremonies.fields.prefix, "==", ceremonyPrefix)
            .get()

        if (ceremonyCollection.empty) logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_BUCKET_NOT_CONNECTED_TO_CEREMONY)
    }*/

    /**
     * Helper function to check whether a contributor is uploading a file related to its contribution.
     * @param contributorId <string> - the unique identifier of the contributor.
     * @param ceremonyId <string> - the unique identifier of the ceremony.
     * @param objectKey <string> - the object key of the file being uploaded.
     */
    /*async checkUploadingFileValidity(contributorId: string, ceremonyId: string, objectKey: string) {
        // Get the circuits for the ceremony
        const circuits = await getCeremonyCircuits(ceremonyId)

        // Get the participant document
        const participantDoc = await getDocumentById(getParticipantsCollectionPath(ceremonyId), contributorId!)
        const participantData = participantDoc.data()

        if (!participantData) logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)

        // The index of the circuit will be the contribution progress - 1
        const index = participantData?.contributionProgress
        // If the index is zero the user is not the current contributor
        if (index === 0) logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_CANNOT_INTERACT_WITH_MULTI_PART_UPLOAD)
        // We can safely use index - 1
        const circuit = circuits.at(index - 1)

        // If the circuit is undefined, throw an error
        if (!circuit) logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_CANNOT_INTERACT_WITH_MULTI_PART_UPLOAD)
        // Extract the data we need
        const { prefix, waitingQueue } = circuit!.data()
        const { completedContributions, currentContributor } = waitingQueue

        // If we are not a contributor to this circuit then we cannot upload files
        if (currentContributor === contributorId) {
            // Get the index of the zKey
            const contributorZKeyIndex = formatZkeyIndex(completedContributions + 1)
            // The uploaded file must be the expected one
            const zkeyNameContributor = `${prefix}_${contributorZKeyIndex}.zkey`
            const contributorZKeyStoragePath = getZkeyStorageFilePath(prefix, zkeyNameContributor)

            // If the object key does not have the expected storage path, throw an error
            if (objectKey !== contributorZKeyStoragePath) {
                logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_WRONG_OBJECT_KEY)
            }
        } else logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_CANNOT_INTERACT_WITH_MULTI_PART_UPLOAD)
    }
    */

    async createBucket(ceremonyPrefix: string) {
        const bucketName = getBucketName(ceremonyPrefix, String(process.env.AWS_CEREMONY_BUCKET_POSTFIX))
        const S3 = await getS3Client()
        try {
            // Try to get information about the bucket.
            await S3.send(new HeadBucketCommand({ Bucket: bucketName }))
            // If the command succeeded, the bucket exists, throw an error.
            logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_INVALID_BUCKET_NAME)
        } catch (error: any) {
            if (error.name === "NotFound") {
                // Prepare S3 command.
                const command = new CreateBucketCommand({
                    Bucket: bucketName,
                    // CreateBucketConfiguration: {
                    //     LocationConstraint: String(process.env.AWS_REGION)
                    // },
                    ObjectOwnership: "BucketOwnerPreferred"
                })
                try {
                    // Execute S3 command.
                    const response = await S3.send(command)
                    // Check response.
                    if (response.$metadata.httpStatusCode === 200 && !!response.Location)
                        printLog(`The AWS S3 bucket ${bucketName} has been created successfully`, LogLevel.LOG)

                    const publicBlockCommand = new PutPublicAccessBlockCommand({
                        Bucket: bucketName,
                        PublicAccessBlockConfiguration: {
                            BlockPublicAcls: false,
                            BlockPublicPolicy: false
                        }
                    })

                    // Allow objects to be public
                    const publicBlockResponse = await S3.send(publicBlockCommand)
                    // Check response.
                    if (publicBlockResponse.$metadata.httpStatusCode === 204)
                        printLog(
                            `The AWS S3 bucket ${bucketName} has been set with the PublicAccessBlock disabled.`,
                            LogLevel.LOG
                        )

                    // Set CORS
                    const corsCommand = new PutBucketCorsCommand({
                        Bucket: bucketName,
                        CORSConfiguration: {
                            CORSRules: [
                                {
                                    AllowedMethods: ["GET", "PUT"],
                                    AllowedOrigins: ["*"],
                                    ExposeHeaders: ["ETag", "Content-Length"],
                                    AllowedHeaders: ["*"]
                                }
                            ]
                        }
                    })
                    const corsResponse = await S3.send(corsCommand)
                    // Check response.
                    if (corsResponse.$metadata.httpStatusCode === 200)
                        printLog(
                            `The AWS S3 bucket ${bucketName} has been set with the CORS configuration.`,
                            LogLevel.LOG
                        )
                    return {
                        bucketName
                    }
                } catch (error: any) {
                    /** * {@link https://docs.aws.amazon.com/simspaceweaver/latest/userguide/troubeshooting_too-many-buckets.html | TooManyBuckets} */
                    if (error.$metadata.httpStatusCode === 400 && error.Code === `TooManyBuckets`)
                        logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_TOO_MANY_BUCKETS)

                    // @todo handle more errors here.
                    const commonError = COMMON_ERRORS.CM_INVALID_REQUEST
                    const additionalDetails = error.toString()
                    logAndThrowError(makeError(commonError.code, commonError.message, additionalDetails))
                }
            } else {
                // If there was a different error, re-throw it.
                const commonError = COMMON_ERRORS.CM_INVALID_REQUEST
                const additionalDetails = error.toString()

                logAndThrowError(makeError(commonError.code, commonError.message, additionalDetails))
            }
        }
    }

    async startMultipartUpload(data: StartMultiPartUploadDataDto, userId: string) {
        console.log(data, userId)
        /*// Prepare data.
        const { ceremonyPrefix, objectKey, ceremonyId } = data
        const bucketName = getBucketName(ceremonyPrefix, String(process.env.AWS_CEREMONY_BUCKET_POSTFIX))
        // TODO: Check if the user is a current contributor.
        // context.auth?.token.participant &&
        if ( !!ceremonyId) {
            // Check pre-condition.
            await this.checkPreConditionForCurrentContributorToInteractWithMultiPartUpload(userId!, ceremonyId)

            // Check whether the bucket where the object for which we are generating the pre-signed url is dedicated to a ceremony.
            await this.checkIfBucketIsDedicatedToCeremony(bucketName)

            // Check the validity of the uploaded file.
            await this.checkUploadingFileValidity(userId!, ceremonyId!, objectKey)
        }

        // Connect to S3.
        const S3 = await getS3Client()

        // Prepare S3 command.
        const command = new CreateMultipartUploadCommand({
            Bucket: bucketName,
            Key: objectKey,
            ACL: context.auth?.token.participant ? "private" : "public-read"
        })

        try {
            // Execute S3 command.
            const response = await S3.send(command)
            if (response.$metadata.httpStatusCode === 200 && !!response.UploadId) {
                printLog(
                    `The multi-part upload identifier is ${response.UploadId}. Requested by ${userId}`,
                    LogLevel.DEBUG
                )

                return response.UploadId
            }
        } catch (error: any) {
            // eslint-disable-next-line @typescript-eslint/no-shadow
            // @todo handle more errors here.
            if (error.$metadata.httpStatusCode !== 200) {
                const commonError = COMMON_ERRORS.CM_INVALID_REQUEST
                const additionalDetails = error.toString()

                logAndThrowError(makeError(commonError.code, commonError.message, additionalDetails))
            }
        }*/
    }
}
