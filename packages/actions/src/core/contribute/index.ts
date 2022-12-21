import { Firestore, where } from "firebase/firestore"
import { CeremonyCollectionField, CeremonyState, Collections, FirebaseDocumentInfo } from "../../../types/index"
import { queryCollection, fromQueryToFirebaseDocumentInfo, getAllCollectionDocs } from "../..//helpers/query"
import { Functions, httpsCallable, httpsCallableFromURL } from "firebase/functions"
import { convertToGB } from "../../helpers/storage"

/**
 * Query for opened ceremonies documents and return their data (if any).
 * @param firestoreDatabase <Firestore> - the Firebase Firestore associated to the current application.
 * @returns <Promise<Array<FirebaseDocumentInfo>>>
 */
export const getOpenedCeremonies = async (firestoreDatabase: Firestore): Promise<Array<FirebaseDocumentInfo>> => {
    const runningStateCeremoniesQuerySnap = await queryCollection(firestoreDatabase, Collections.CEREMONIES, [
        where(CeremonyCollectionField.STATE, "==", CeremonyState.OPENED),
        where(CeremonyCollectionField.END_DATE, ">=", Date.now())
    ])

    return runningStateCeremoniesQuerySnap.empty && runningStateCeremoniesQuerySnap.size === 0
        ? []
        : fromQueryToFirebaseDocumentInfo(runningStateCeremoniesQuerySnap.docs)
}

/**
 * Retrieve all circuits associated to a ceremony.
 * @param firestoreDatabase <Firestore> - the Firebase Firestore associated to the current application.
 * @param ceremonyId <string> - the identifier of the ceremony.
 * @returns Promise<Array<FirebaseDocumentInfo>>
 */
export const getCeremonyCircuits = async (
    firestoreDatabase: Firestore,
    ceremonyId: string
): Promise<Array<FirebaseDocumentInfo>> =>
    fromQueryToFirebaseDocumentInfo(
        await getAllCollectionDocs(firestoreDatabase, `${Collections.CEREMONIES}/${ceremonyId}/${Collections.CIRCUITS}`)
    ).sort((a: FirebaseDocumentInfo, b: FirebaseDocumentInfo) => a.data.sequencePosition - b.data.sequencePosition)


/**
 * Calls the cloud function checkParticipantForCeremony
 * @param functions <Functions> - the Firebase functions
 * @param ceremonyId <string> - the ceremony ID for which to query participants
 * @returns 
 */
export const checkParticipantForCeremony = async (
    functions: Functions,
    ceremonyId: string
): Promise<any> => {
    const cf = httpsCallable(functions, 'checkParticipantForCeremony')
    const { data } = await cf({ ceremonyId: ceremonyId })
    return data 
}


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
    if (filteredCircuits.length !== 1) throw new Error('Contribute-0001: Something went wrong when retrieving the data from the database')

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
    const cf = httpsCallable(functions, 'permanentlyStoreCurrentContributionTimeAndHash')
    await cf({
        ceremonyId: ceremonyId,
        contributionComputationTime,
        contributionHash
    })
}


/**
 * Call the makeProgressToNextContribution cloud function
 * @param functions <Functions> - the cloud functions
 * @param ceremonyId <string> - the ceremony Id
 */
export const makeProgressToNextContribution = async (
    functions: Functions,
    ceremonyId: string 
) => {
    const cf = httpsCallable(functions, 'makeProgressToNextContribution')
    await cf({
        ceremonyId
    })
}

/**
 * Call the resumeContributionAfterTimeoutExpiration cloud function
 * @param functions <Functions> - the cloud functions.
 * @param ceremonyId <string> - the ceremony Id.
 */
export const resumeContributionAfterTimeoutExpiration = async (
    functions: Functions,
    ceremonyId: string 
) => {
    const cf = httpsCallable(functions, 'resumeContributionAfterTimeoutExpiration')
    await cf({
        ceremonyId
    })
}

/**
 * Call the progressToNextContributionStep cloud function
 * @param ceremonyId <string> - the ceremony ID to which we want to contribute to.
 */
export const progressToNextContributionStep = async (
    functions: Functions,
    ceremonyId: string 
) => {
    const cf = httpsCallable(functions, 'progressToNextContributionStep')
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
 * @param username <string> - the 
 */
export const verifyContribution = async (
    functions: Functions,
    verifyContributionURL: string,
    ceremonyId: string,
    circuitId: string, 
    username: string,
    bucketName: string 
): Promise<any> => {
    const cf = httpsCallableFromURL(
        functions, 
        verifyContributionURL,
        {
            timeout: 3600000
        }
    )

    const { data: response } = await cf({
        ceremonyId: ceremonyId,
        circuitId: circuitId,
        username,
        bucketName: bucketName
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
    const cf = httpsCallable(functions, 'temporaryStoreCurrentContributionMultiPartUploadId')
    await cf({
        ceremonyId,
        uploadId: uploadIdZkey
    })
}

/**
 * Call the temporaryStoreCurrentContributionUploadedChunk cloud function
 * @param functions <Functions> - the cloud functions.
 * @param ceremonyId <string> - the ceremony ID.
 * @param eTag <string> - the eTag.
 * @param partNumber <number> - the part number.
 */
export const temporaryStoreCurrentContributionUploadedChunk = async (
    functions: Functions,
    ceremonyId: string, 
    eTag: string,
    partNumber: number 
) => {
    const cf = httpsCallable(functions, 'temporaryStoreCurrentContributionUploadedChunkData')
    await cf({
        ceremonyId,
        eTag,
        partNumber
    })
}

/**
 * Return the memory space requirement for a zkey in GB.
 * @param zKeySizeInBytes <number> - the size of the zkey in bytes.
 * @returns <number>
 */
export const getZkeysSpaceRequirementsForContributionInGB = (zKeySizeInBytes: number): number =>
    // nb. mul per 2 is necessary because download latest + compute newest.
    convertToGB(zKeySizeInBytes * 2, true)