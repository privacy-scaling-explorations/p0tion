import { httpsCallable, Functions } from "firebase/functions"

/**
 * Calls the checkAndPrepareCoordinatorForFinalization cloud function
 * @param functions <Functions> - the Cloud functions
 * @param ceremonyId <string> - the ceremony Id
 */
export const checkAndPrepareCoordinatorForFinalization = async (
    functions: Functions,
    ceremonyId: string
): Promise<any> => {
    const cf = httpsCallable(functions, "checkAndPrepareCoordinatorForFinalization")
    return cf({
        ceremonyId
    })
}

/**
 * Calls the finalizeLastContribution cloud function
 * @param functions <Functions> - Firebase functions
 * @param ceremonyId <string> - the ceremony Id
 * @param circuitId <any> - the id for the circuit to finalize
 * @param bucketName <string> - the bucket name where to store the result
 */
export const finalizeLastContribution = async (
    functions: Functions,
    ceremonyId: string,
    circuitId: any,
    bucketName: string
) => {
    const cf = httpsCallable(functions, "finalizeLastContribution")
    await cf({
        ceremonyId,
        circuitId,
        bucketName
    })
}

/**
 * Calls the finalizeCeremony cloud function
 * @param functions <Functions> - the Firebase functions
 * @param ceremonyId <string> - the id for the ceremony to finalize
 */
export const finalizeCeremony = async (functions: Functions, ceremonyId: string) => {
    const cf = httpsCallable(functions, "finalizeCeremony")
    await cf({
        ceremonyId
    })
}
