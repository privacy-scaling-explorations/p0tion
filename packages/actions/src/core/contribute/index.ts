import { Functions, httpsCallable, httpsCallableFromURL } from "firebase/functions"

/**
 * Calls the permanentlyStoreCurrentContributionTimeAndHash cloud function
 * @param functions <Functions> - the firebase functions
 * @param ceremonyId <string> - the ceremony id
 * @param contributionComputationTime <number> - the time when it was computed
 * @param contributingHash <string> - the hash of the contribution
 */
export const permanentlyStoreCurrentContributionTimeAndHash = async (
    functions: Functions,
    ceremonyId: string,
    contributionComputationTime: number,
    contributionHash: string
) => {
    const cf = httpsCallable(functions, "permanentlyStoreCurrentContributionTimeAndHash")
    await cf({
        ceremonyId,
        contributionComputationTime,
        contributionHash
    })
}

/**
 * Call the progressToNextContributionStep cloud function
 * @param ceremonyId <string> - the ceremony ID to which we want to contribute to.
 */
export const progressToNextContributionStep = async (functions: Functions, ceremonyId: string) => {
    const cf = httpsCallable(functions, "progressToNextContributionStep")
    await cf({
        ceremonyId
    })
}

/**
 * Call the verifyContribution cloud function
 * @param functions <Functions> - the cloud functions.
 * @param verifyContributionURL <string> - the url for the contribution verification.
 * @param ceremonyId <string> - the ID of the ceremony.
 * @param circuitId <string> - the ID of the circuit to which the user contribute.
 * @param ghUsername <string> - the Github username of the user.
 */
export const verifyContribution = async (
    functions: Functions,
    verifyContributionURL: string,
    ceremonyId: string,
    circuitId: string,
    ghUsername: string,
    bucketName: string
): Promise<any> => {
    const cf = httpsCallableFromURL(functions, verifyContributionURL, {
        timeout: 3600000
    })

    const { data: response } = await cf({
        ceremonyId,
        circuitId,
        ghUsername,
        bucketName
    })

    return response
}

/**
 * Calls the temporaryStoreCurrentContributionMultiPartUploadId cloud function
 * @param functions <Functions> - the cloud functions.
 * @param ceremonyId <string> - the ID of the ceremony.
 * @param uploadIdZKey <string> - the upload identifier.
 */
export const temporaryStoreCurrentContributionMultiPartUploadId = async (
    functions: Functions,
    ceremonyId: string,
    uploadIdZkey: string
) => {
    const cf = httpsCallable(functions, "temporaryStoreCurrentContributionMultiPartUploadId")
    await cf({
        ceremonyId,
        uploadId: uploadIdZkey
    })
}

/**
 * Call the temporaryStoreCurrentContributionUploadedChunkData cloud function
 * @param functions <Functions> - the cloud functions.
 * @param ceremonyId <string> - the ceremony ID.
 * @param eTag <string> - the eTag.
 * @param partNumber <number> - the part number.
 */
export const temporaryStoreCurrentContributionUploadedChunkData = async (
    functions: Functions,
    ceremonyId: string,
    eTag: string,
    partNumber: number
) => {
    const cf = httpsCallable(functions, "temporaryStoreCurrentContributionUploadedChunkData")
    await cf({
        ceremonyId,
        eTag,
        partNumber
    })
}
