import { Firestore } from "firebase/firestore"
import fs from "fs"
import winston, { Logger } from "winston"
import { CircuitMetadata, Contribution, ContributionValidity, FirebaseDocumentInfo } from "../types"
import { finalContributionIndex, genesisZkeyIndex } from "./constants"
import {
    getCircuitContributionsFromContributor,
    getDocumentById,
    getCircuitsCollectionPath,
    getContributionsCollectionPath
} from "./database"

/**
 * Extract data from a R1CS metadata file generated with a custom file-based logger.
 * @notice useful for extracting metadata circuits contained in the generated file using a logger
 * on the `r1cs.info()` method of snarkjs.
 * @param fullFilePath <string> - the full path of the file.
 * @param keyRgx <RegExp> - the regular expression linked to the key from which you want to extract the value.
 * @returns <string> - the stringified extracted value.
 */
export const extractR1CSInfoValueForGivenKey = (fullFilePath: string, keyRgx: RegExp): string => {
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
export const computeSmallestPowersOfTauForCircuit = (constraints: number, outputs: number) => {
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

/**
 * Automate the generation of an entropy for a contribution.
 * @dev Took inspiration from here https://github.com/glamperd/setup-mpc-ui/blob/master/client/src/state/Compute.tsx#L112.
 * @todo we need to improve the entropy generation (too naive).
 * @returns <string> - the auto-generated entropy.
 */
export const autoGenerateEntropy = () => new Uint8Array(256).map(() => Math.random() * 256).toString()

/**
 * Check and return the circuit document based on its sequence position among a set of circuits (if any).
 * @dev there should be only one circuit with a provided sequence position. This method checks and return an
 * error if none is found.
 * @param circuits <Array<FirebaseDocumentInfo>> - the set of ceremony circuits documents.
 * @param sequencePosition <number> - the sequence position (index) of the circuit to be found and returned.
 * @returns <FirebaseDocumentInfo> - the document of the circuit in the set of circuits that has the provided sequence position.
 */
export const getCircuitBySequencePosition = (
    circuits: Array<FirebaseDocumentInfo>,
    sequencePosition: number
): FirebaseDocumentInfo => {
    // Filter by sequence position.
    const matchedCircuits = circuits.filter(
        (circuitDocument: FirebaseDocumentInfo) => circuitDocument.data.sequencePosition === sequencePosition
    )

    if (matchedCircuits.length !== 1)
        throw new Error(
            `Unable to find the circuit having position ${sequencePosition}. Run the command again and, if this error persists please contact the coordinator.`
        )

    return matchedCircuits.at(0)!
}

/**
 * Convert bytes or chilobytes into gigabytes with customizable precision.
 * @param bytesOrKb <number> - the amount of bytes or chilobytes to be converted.
 * @param isBytes <boolean> - true when the amount to be converted is in bytes; otherwise false (= Chilobytes).
 * @returns <number> - the converted amount in GBs.
 */
export const convertBytesOrKbToGb = (bytesOrKb: number, isBytes: boolean): number =>
    Number(bytesOrKb / 1024 ** (isBytes ? 3 : 2))

/**
 * Get the validity of contributors' contributions for each circuit of the given ceremony (if any).
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @param circuits <Array<FirebaseDocumentInfo>> - the array of ceremony circuits documents.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param participantId <string> - the unique identifier of the contributor.
 * @param isFinalizing <boolean> - flag to discriminate between ceremony finalization (true) and contribution (false).
 * @returns <Promise<Array<ContributionValidity>>> - a list of contributor contributions together with contribution validity (based on coordinator verification).
 */
export const getContributionsValidityForContributor = async (
    firestoreDatabase: Firestore,
    circuits: Array<FirebaseDocumentInfo>,
    ceremonyId: string,
    participantId: string,
    isFinalizing: boolean
): Promise<Array<ContributionValidity>> => {
    const contributionsValidity: Array<ContributionValidity> = []

    for await (const circuit of circuits) {
        // Get circuit contribution from contributor.
        const circuitContributionsFromContributor = await getCircuitContributionsFromContributor(
            firestoreDatabase,
            ceremonyId,
            circuit.id,
            participantId
        )

        // Check for ceremony finalization (= there could be more than one contribution).
        const contribution = isFinalizing
            ? circuitContributionsFromContributor
                  .filter(
                      (contributionDocument: FirebaseDocumentInfo) =>
                          contributionDocument.data.zkeyIndex === finalContributionIndex
                  )
                  .at(0)
            : circuitContributionsFromContributor.at(0)

        if (!contribution)
            throw new Error(
                "Unable to retrieve contributions for the participant. There may have occurred a database-side error. Please, we kindly ask you to terminate the current session and repeat the process"
            )

        contributionsValidity.push({
            contributionId: contribution?.id,
            circuitId: circuit.id,
            valid: contribution?.data.valid
        })
    }

    return contributionsValidity
}

/**
 * Return the public attestation preamble for given contributor.
 * @param contributorIdentifier <string> - the identifier of the contributor (handle, name, uid).
 * @param ceremonyName <string> - the name of the ceremony.
 * @param isFinalizing <boolean> - true when the coordinator is finalizing the ceremony, otherwise false.
 * @returns <string> - the public attestation preamble.
 */
export const getPublicAttestationPreambleForContributor = (
    contributorIdentifier: string,
    ceremonyName: string,
    isFinalizing: boolean
) =>
    `Hey, I'm ${contributorIdentifier} and I have ${
        isFinalizing ? "finalized" : "contributed to"
    } the ${ceremonyName} MPC Phase2 Trusted Setup ceremony.\nThe following are my contribution signatures:`

/**
 * Check and prepare public attestation for the contributor made only of its valid contributions.
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @param circuits <Array<FirebaseDocumentInfo>> - the array of ceremony circuits documents.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param participantId <string> - the unique identifier of the contributor.
 * @param participantContributions <Array<Co> - the document data of the participant.
 * @param contributorIdentifier <string> - the identifier of the contributor (handle, name, uid).
 * @param ceremonyName <string> - the name of the ceremony.
 * @param isFinalizing <boolean> - true when the coordinator is finalizing the ceremony, otherwise false.
 * @returns <Promise<string>> - the public attestation for the contributor.
 */
export const generateValidContributionsAttestation = async (
    firestoreDatabase: Firestore,
    circuits: Array<FirebaseDocumentInfo>,
    ceremonyId: string,
    participantId: string,
    participantContributions: Array<Contribution>,
    contributorIdentifier: string,
    ceremonyName: string,
    isFinalizing: boolean
): Promise<string> => {
    // Generate the attestation preamble for the contributor.
    let publicAttestation = getPublicAttestationPreambleForContributor(
        contributorIdentifier,
        ceremonyName,
        isFinalizing
    )

    // Get contributors' contributions validity.
    const contributionsWithValidity = await getContributionsValidityForContributor(
        firestoreDatabase,
        circuits,
        ceremonyId,
        participantId,
        isFinalizing
    )

    for await (const contributionWithValidity of contributionsWithValidity) {
        // Filter for the related contribution document info.
        const matchedContributions = participantContributions.filter(
            (contribution: Contribution) => contribution.doc === contributionWithValidity.contributionId
        )

        if (matchedContributions.length === 0)
            throw new Error(
                `Unable to retrieve given circuit contribution information. This could happen due to some errors while writing the information on the database.`
            )

        if (matchedContributions.length > 1)
            throw new Error(`Duplicated circuit contribution information. Please, contact the coordinator.`)

        const participantContribution = matchedContributions.at(0)!

        // Get circuit document (the one for which the contribution was calculated).
        const circuitDocument = await getDocumentById(
            firestoreDatabase,
            getCircuitsCollectionPath(ceremonyId),
            contributionWithValidity.circuitId
        )
        const contributionDocument = await getDocumentById(
            firestoreDatabase,
            getContributionsCollectionPath(ceremonyId, contributionWithValidity.circuitId),
            participantContribution.doc
        )

        if (!contributionDocument.data() || !circuitDocument.data())
            throw new Error(`Something went wrong when retrieving the data from the database`)

        // Extract data.
        const { sequencePosition, prefix } = circuitDocument.data()!
        const { zkeyIndex } = contributionDocument.data()!

        // Update public attestation.
        publicAttestation = `${publicAttestation}\n\nCircuit # ${sequencePosition} (${prefix})\nContributor # ${
            zkeyIndex > 0 ? Number(zkeyIndex) : zkeyIndex
        }\n${participantContribution.hash}`
    }

    return publicAttestation
}

/**
 * Create a custom logger to write logs on a local file.
 * @param filename <string> - the name of the output file (where the logs are going to be written).
 * @param level <winston.LoggerOptions["level"]> - the option for the logger level (e.g., info, error).
 * @returns <Logger> - a customized winston logger for files.
 */
export const createCustomLoggerForFile = (filename: string, level: winston.LoggerOptions["level"] = "info"): Logger =>
    winston.createLogger({
        level,
        transports: new winston.transports.File({
            filename,
            format: winston.format.printf((log) => log.message),
            level
        })
    })
