import { Functions, httpsCallable, httpsCallableFromURL } from "firebase/functions"
import { FirebaseDocumentInfo } from "../../types"

/**
 * Return the next circuit where the participant needs to compute or has computed the contribution.
 * @param circuits <Array<FirebaseDocumentInfo>> - the ceremony circuits document.
 * @param nextCircuitPosition <number> - the position in the sequence of circuits where the next contribution must be done.
 * @returns <FirebaseDocumentInfo>
 */
export const getNextCircuitForContribution = (
    circuits: Array<FirebaseDocumentInfo>,
    nextCircuitPosition: number
): FirebaseDocumentInfo => {
    // Filter for sequence position (should match contribution progress).
    const filteredCircuits = circuits.filter(
        (circuit: FirebaseDocumentInfo) => circuit.data.sequencePosition === nextCircuitPosition
    )

    // There must be only one.
    if (filteredCircuits.length !== 1)
        throw new Error("Contribute-0001: Something went wrong when retrieving the data from the database")

    return filteredCircuits.at(0)!
}

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
 * Call the makeProgressToNextContribution cloud function
 * @param functions <Functions> - the cloud functions
 * @param ceremonyId <string> - the ceremony Id
 */
export const makeProgressToNextContribution = async (functions: Functions, ceremonyId: string) => {
    const cf = httpsCallable(functions, "makeProgressToNextContribution")
    await cf({
        ceremonyId
    })
}

/**
 * Call the resumeContributionAfterTimeoutExpiration cloud function
 * @param functions <Functions> - the cloud functions.
 * @param ceremonyId <string> - the ceremony Id.
 */
export const resumeContributionAfterTimeoutExpiration = async (functions: Functions, ceremonyId: string) => {
    const cf = httpsCallable(functions, "resumeContributionAfterTimeoutExpiration")
    await cf({
        ceremonyId
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

/**
 * Convert bytes or chilobytes into gigabytes with customizable precision.
 * @param bytesOrKB <number> - bytes or KB to be converted.
 * @param isBytes <boolean> - true if the input is in bytes; otherwise false for KB input.
 * @returns <number>
 */
export const convertToGB = (bytesOrKB: number, isBytes: boolean): number =>
    Number(bytesOrKB / 1024 ** (isBytes ? 3 : 2))

/**
 * Return the memory space requirement for a zkey in GB.
 * @param zKeySizeInBytes <number> - the size of the zkey in bytes.
 * @returns <number>
 */
export const getZkeysSpaceRequirementsForContributionInGB = (zKeySizeInBytes: number): number =>
    // nb. mul per 2 is necessary because download latest + compute newest.
    convertToGB(zKeySizeInBytes * 2, true)
