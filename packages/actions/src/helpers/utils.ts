import fs from "fs"
import { CircuitMetadata } from "../types"
import { genesisZkeyIndex } from "./constants"

/**
 * Extract data contained in a logger-generated file containing information extracted from R1CS file read.
 * @notice useful for extracting metadata circuits contained in the generated file using a logger
 * on the `r1cs.info()` method of snarkjs.
 * @param fullFilePath <string> - the full path of the file.
 * @param keyRgx <RegExp> - the regular expression linked to the key from which you want to extract the value.
 * @returns <string> - the stringified extracted value.
 */
const extractR1CSInfoValueForGivenKey = (fullFilePath: string, keyRgx: RegExp): string => {
    // Read the logger file.
    const fileContents = fs.readFileSync(fullFilePath, "utf-8")

    // Check for the matching value.
    const matchingValue = fileContents.match(keyRgx)

    if (!matchingValue)
        throw new Error(
            `Unable to retrieve circuit metadata. Possible causes may involve an error while using the logger. Please, check whether the corresponding \`.log\` file is present in your local \`output/setup/metadata\` folder. In any case, we kindly ask you to terminate the current session and repeat the process.`
        )

    // Elaborate spaces and special characters to extract the value.
    // nb. this is a manual process which follows this custom arbitrary extraction rule
    // accordingly to the output produced by the `r1cs.info()` method from snarkjs library.
    return matchingValue?.at(0)?.split(":")[1].replace(" ", "").split("#")[0].replace("\n", "")!
}

/**
 * Calculate the smallest amount of Powers of Tau needed for a circuit with a constraint size.
 * @param constraints <number> - the number of circuit constraints (extracted from metadata).
 * @param outputs <number> - the number of circuit outputs (extracted from metadata)
 * @returns <number> - the smallest amount of Powers of Tau for the given constraint size.
 */
const computeSmallestPowersOfTauForCircuit = (constraints: number, outputs: number) => {
    let power = 2
    let tau = 2 ** power

    while (constraints + outputs > tau) {
        power += 1
        tau = 2 ** power
    }

    return power
}

/**
 * Transform a number in a zKey index format.
 * @dev this method is aligned with the number of characters of the genesis zKey index (which is a constant).
 * @param progress <number> - the progression in zKey index.
 * @returns <string> - the progression in a zKey index format (`XYZAB`).
 */
export const formatZkeyIndex = (progress: number): string => {
    let index = progress.toString()

    // Pad with zeros if the progression has less digits.
    while (index.length < genesisZkeyIndex.length) {
        index = `0${index}`
    }

    return index
}

/**
 * Extract the amount of powers from Powers of Tau file name.
 * @dev the PoT files must follow these convention (i_am_a_pot_file_09.ptau) where the numbers before '.ptau' are the powers.
 * @param potCompleteFilename <string> - the complete filename of the Powers of Tau file.
 * @returns <number> - the amount of powers.
 */
export const extractPoTFromFilename = (potCompleteFilename: string): number =>
    Number(potCompleteFilename.split("_").pop()?.split(".").at(0))

/**
 * Extract a prefix consisting of alphanumeric and underscore characters from a string with arbitrary characters.
 * @dev replaces all special symbols and whitespaces with an underscore char ('_'). Convert all uppercase chars to lowercase.
 * @notice example: str = 'Multiplier-2!2.4.zkey'; output prefix = 'multiplier_2_2_4.zkey'.
 * NB. Prefix extraction is a key process that conditions the name of the ceremony artifacts, download/upload from/to storage, collections paths.
 * @param str <string> - the arbitrary string from which to extract the prefix.
 * @returns <string> - the resulting prefix.
 */
export const extractPrefix = (str: string): string =>
    // eslint-disable-next-line no-useless-escape
    str.replace(/[`\s~!@#$%^&*()|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, "-").toLowerCase()

/**
 * Extract the metadata for a circuit.
 * @dev this method use the data extracted while reading the R1CS (r1cs.info) in the `getInputDataToAddCircuitToCeremony()` method.
 * @notice this method calculate the smallest pot needed and store this value as circuit metadata.
 * @param r1csMetadataFilePath <string> - the file path where the R1CS metadata are stored (.log ext).
 * @returns <CircuitMetadata> - the metadata of the circuit.
 */
export const extractCircuitMetadata = (r1csMetadataFilePath: string): CircuitMetadata => {
    // Extract info from file.
    const curve = extractR1CSInfoValueForGivenKey(r1csMetadataFilePath, /Curve: .+\n/s)
    const wires = Number(extractR1CSInfoValueForGivenKey(r1csMetadataFilePath, /# of Wires: .+\n/s))
    const constraints = Number(extractR1CSInfoValueForGivenKey(r1csMetadataFilePath, /# of Constraints: .+\n/s))
    const privateInputs = Number(extractR1CSInfoValueForGivenKey(r1csMetadataFilePath, /# of Private Inputs: .+\n/s))
    const publicInputs = Number(extractR1CSInfoValueForGivenKey(r1csMetadataFilePath, /# of Public Inputs: .+\n/s))
    const labels = Number(extractR1CSInfoValueForGivenKey(r1csMetadataFilePath, /# of Labels: .+\n/s))
    const outputs = Number(extractR1CSInfoValueForGivenKey(r1csMetadataFilePath, /# of Outputs: .+\n/s))

    // Return circuit metadata.
    return {
        curve,
        wires,
        constraints,
        privateInputs,
        publicInputs,
        labels,
        outputs,
        pot: computeSmallestPowersOfTauForCircuit(constraints, outputs)
    }
}
