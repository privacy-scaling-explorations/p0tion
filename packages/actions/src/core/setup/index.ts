import { Functions, httpsCallable } from "firebase/functions"
import { CeremonyInputData, Circuit } from "../../../types"

/**
 * Setup a new ceremony by calling a cloud function
 * @param functions <Functions> - the firebase functions object
 * @param ceremonyInputData <CeremonyInputData> - the ceremony data
 * @param ceremonyPrefix <string> - the prefix for storage
 * @param circuits <Circuit[]> - the circuit data for the ceremony 
 * 
*/
export const setupCeremony = async (
    functions: Functions,
    ceremonyInputData: CeremonyInputData,
    ceremonyPrefix: string,
    circuits: Circuit[]
    ) => {
    const cf = httpsCallable(functions, 'setupCeremony')
    await cf({
        ceremonyInputData,
        ceremonyPrefix,
        circuits
    })
}