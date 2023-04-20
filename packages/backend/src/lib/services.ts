import { S3Client } from "@aws-sdk/client-s3"
import { COMMON_ERRORS, logAndThrowError } from "./errors"

/**
 * Return a configured and connected instance of the AWS S3 client.
 * @dev this method check and utilize the environment variables to configure the connection
 * w/ the S3 client.
 * @returns <Promise<S3Client>> - the instance of the connected S3 Client instance.
 */
export const getS3Client = async (): Promise<S3Client> => {
    if (
        !process.env.AWS_ACCESS_KEY_ID ||
        !process.env.AWS_SECRET_ACCESS_KEY ||
        !process.env.AWS_REGION ||
        !process.env.AWS_PRESIGNED_URL_EXPIRATION ||
        !process.env.AWS_CEREMONY_BUCKET_POSTFIX
    )
        logAndThrowError(COMMON_ERRORS.CM_WRONG_CONFIGURATION)

    // Return the connected S3 Client instance.
    return new S3Client({
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
        },
        region: process.env.AWS_REGION!
    })
}
