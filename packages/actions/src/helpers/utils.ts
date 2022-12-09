/**
 * Get a value from a key information about a circuit.
 * @param circuitInfo <string> - the stringified content of the .r1cs file.
 * @param rgx <RegExp> - regular expression to match the key.
 * @returns <string>
 */
export const getCircuitMetadataFromR1csFile = (circuitInfo: string, rgx: RegExp): string   => {
    // Match.
    const matchInfo = circuitInfo.match(rgx)

    if (!matchInfo) return ''

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