import dotenv from "dotenv"
import { S3Client } from "@aws-sdk/client-s3"
import ethers from "ethers"
import { COMMON_ERRORS, logAndThrowError } from "./errors"

dotenv.config()

let provider: ethers.providers.Provider

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

/**
 * Returns a Prvider, connected via a configured JSON URL or else 
 * the ethers.js default provider, using configured API keys.
 * @returns <ethers.providers.Provider> An Eth node provider
 */
export const setEthProvider = (): ethers.providers.Provider => {
    if (provider) return provider

    // Use JSON URL if defined
    if (process.env.ETH_PROVIDER_JSON_URL) {
        provider = new ethers.providers.JsonRpcProvider(process.env.ETH_PROVIDER_JSON_URL)
    } else {
        // Otherwise, connect the default provider with ALchemy, Infura, or both
        provider = ethers.providers.getDefaultProvider("homestead",
            {
                alchemy: process.env.ETH_PROVIDER_ALCHEMY_API_KEY!,
                infura: process.env.ETH_PROVIDER_INFURA_API_KEY!,
            }
        )
    }

    return provider
}