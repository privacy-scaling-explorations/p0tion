import { Functions, httpsCallable } from "firebase/functions"
import { CeremonyInputData, CircuitDocument } from "../types"
import { commonTerms } from "./constants"

/**
 * Setup a new ceremony by calling the related cloud function.
 * @param functions <Functions> - the Firebase cloud functions object instance.
 * @param ceremonyInputData <CeremonyInputData> - the input data of the ceremony.
 * @param ceremonyPrefix <string> - the prefix of the ceremony.
 * @param circuits <Circuit[]> - the circuits data.
 * @returns Promise<string> - the unique identifier of the created ceremony.
 */
export const setupCeremony = async (
    functions: Functions,
    ceremonyInputData: CeremonyInputData,
    ceremonyPrefix: string,
    circuits: CircuitDocument[]
): Promise<string> => {
    const cf = httpsCallable(functions, commonTerms.cloudFunctionsNames.setupCeremony)

    const { data: ceremonyId } = await cf({
        ceremonyInputData,
        ceremonyPrefix,
        circuits
    })
    return String(ceremonyId)
}

/**
 * Check the user's current participant status for the ceremony
 * @param functions <Functions> - the Firebase cloud functions object instance.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @returns <boolean> - true when participant is able to contribute; otherwise false.
 */
export const checkParticipantForCeremony = async (functions: Functions, ceremonyId: string): Promise<any> => {
    const cf = httpsCallable(functions, commonTerms.cloudFunctionsNames.checkParticipantForCeremony)

    const { data } = await cf({ ceremonyId })

    return data
}

/**
 * Progress the participant to the next circuit preparing for the next contribution.
 * @param functions <Functions> - the Firebase cloud functions object instance.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 */
export const progressToNextCircuitForContribution = async (functions: Functions, ceremonyId: string): Promise<void> => {
    const cf = httpsCallable(functions, commonTerms.cloudFunctionsNames.progressToNextCircuitForContribution)

    await cf({
        ceremonyId
    })
}

/**
 * Resume the contributor circuit contribution from scratch after the timeout expiration.
 * @param functions <Functions> - the Firebase cloud functions object instance.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 */
export const resumeContributionAfterTimeoutExpiration = async (
    functions: Functions,
    ceremonyId: string
): Promise<void> => {
    const cf = httpsCallable(functions, commonTerms.cloudFunctionsNames.resumeContributionAfterTimeoutExpiration)

    await cf({
        ceremonyId
    })
}
