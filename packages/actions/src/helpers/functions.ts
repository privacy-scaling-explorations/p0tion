import { Functions, httpsCallable } from "firebase/functions"
import { CeremonyInputData, CircuitDocument } from "../types"
import { commonTerms } from "./constants"

/**
 * Setup a new ceremony by calling the related cloud function.
 * @param functions <Functions> - the Firebase cloud functions object instance.
 * @param ceremonyInputData <CeremonyInputData> - the input data of the ceremony.
 * @param ceremonyPrefix <string> - the prefix of the ceremony.
 * @param circuits <Circuit[]> - the circuits data.
 * @returns Promise<any> - the ceremony id if any created.
 */
export const setupCeremony = async (
    functions: Functions,
    ceremonyInputData: CeremonyInputData,
    ceremonyPrefix: string,
    circuits: CircuitDocument[]
): Promise<any> => {
    const cf = httpsCallable(functions, commonTerms.cloudFunctionsNames.setupCeremony)
    const { data: ceremonyId } = await cf({
        ceremonyInputData,
        ceremonyPrefix,
        circuits
    })
    return ceremonyId
}
