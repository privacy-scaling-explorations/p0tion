import { Functions, httpsCallable } from "firebase/functions"
import { CeremonyInputData, CircuitDocument } from "../../types"

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
    circuits: CircuitDocument[]
) => {
    const cf = httpsCallable(functions, "setupCeremony")
    await cf({
        ceremonyInputData,
        ceremonyPrefix,
        circuits
    })
}

/**
 * Get a value from a key information about a circuit.
 * @param circuitInfo <string> - the stringified content of the .r1cs file.
 * @param rgx <RegExp> - regular expression to match the key.
 * @returns <string>
 */
export const getCircuitMetadataFromR1csFile = (circuitInfo: string, rgx: RegExp): string => {
    // Match.
    const matchInfo = circuitInfo.match(rgx)

    if (!matchInfo) throw new Error("Setup-001: The necessary information was not found in the given R1CS file")

    // Split and return the value.
    return matchInfo?.at(0)?.split(":")[1].replace(" ", "").split("#")[0].replace("\n", "")!
}

/**
 * Return the necessary Power of Tau "powers" given the number of circuits constraints.
 * @param constraints <number> - the number of circuit contraints.
 * @param outputs <number> - the number of circuit outputs.
 * @returns <number>
 */
export const estimatePoT = (constraints: number, outputs: number): number => {
    let power = 2
    let pot = 2 ** power

    while (constraints + outputs > pot) {
        power += 1
        pot = 2 ** power
    }

    return power
}
