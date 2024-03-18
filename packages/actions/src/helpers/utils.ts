import { Firestore } from "firebase/firestore"
import fs, { ReadPosition, createWriteStream } from "fs"
import winston, { Logger } from "winston"
import fetch from "@adobe/node-fetch-retry"
import { pipeline } from "stream"
import { promisify } from "util"
import {
    CircuitMetadata,
    Contribution,
    CircuitDocument,
    CircuitInputData,
    ContributionValidity,
    FirebaseDocumentInfo,
    SetupCeremonyData,
    CeremonySetupTemplate,
    CeremonySetupTemplateCircuitArtifacts,
    StringifiedBigInts,
    BigIntVariants
} from "../types/index"
import { finalContributionIndex, genesisZkeyIndex, potFilenameTemplate } from "./constants"
import {
    getCircuitContributionsFromContributor,
    getDocumentById,
    getCircuitsCollectionPath,
    getContributionsCollectionPath
} from "./database"
import { CeremonyTimeoutType } from "../types/enums"
import {
    getPotStorageFilePath,
    getR1csStorageFilePath,
    getWasmStorageFilePath,
    getZkeyStorageFilePath
} from "./storage"
import { blake512FromPath } from "./crypto"

/**
 * Return a string with double digits if the provided input is one digit only.
 * @param in <number> - the input number to be converted.
 * @returns <string> - the two digits stringified number derived from the conversion.
 */
export const convertToDoubleDigits = (amount: number): string => (amount < 10 ? `0${amount}` : amount.toString())

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
    `Hey, I'm ${contributorIdentifier} and I have ${isFinalizing ? "finalized" : "contributed to"} the ${ceremonyName}${
        ceremonyName.toLowerCase().includes("trusted setup") || ceremonyName.toLowerCase().includes("ceremony")
            ? "."
            : " MPC Phase2 Trusted Setup ceremony."
    }\nThe following are my contribution signatures:`

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

/**
 * Return an amount of bytes read from a file to a particular location in the form of a buffer.
 * @param localFilePath <string> - the local path where the artifact will be downloaded.
 * @param offset <number> - the index of the line to be read (0 from the start).
 * @param length <number> - the length of the line to be read.
 * @param position <ReadPosition> - the position inside the file.
 * @returns <Buffer> - the buffer w/ the read bytes.
 */
export const readBytesFromFile = (
    localFilePath: string,
    offset: number,
    length: number,
    position: ReadPosition
): Buffer => {
    // Open the file (read mode).
    const fileDescriptor = fs.openSync(localFilePath, "r")

    // Prepare buffer.
    const buffer = Buffer.alloc(length)

    // Read bytes.
    fs.readSync(fileDescriptor, buffer, offset, length, position)

    // Return the read bytes.
    return buffer
}

/**
 * Given a buffer in little endian format, convert it to bigint
 * @param buffer
 * @returns
 */
export function leBufferToBigint(buffer: Buffer): bigint {
    return BigInt(`0x${buffer.reverse().toString("hex")}`)
}

/**
 * Given an input containing string values, convert them
 * to bigint
 * @param input - The input to convert
 * @returns the input with string values converted to bigint
 */
export const unstringifyBigInts = (input: StringifiedBigInts): BigIntVariants => {
    if (typeof input === "string" && /^[0-9]+$/.test(input)) {
        return BigInt(input)
    }

    if (typeof input === "string" && /^0x[0-9a-fA-F]+$/.test(input)) {
        return BigInt(input)
    }

    if (Array.isArray(input)) {
        return input.map(unstringifyBigInts)
    }

    if (input === null) {
        return null
    }

    if (typeof input === "object") {
        return Object.entries(input).reduce<Record<string, bigint>>((acc, [key, value]) => {
            acc[key] = unstringifyBigInts(value) as bigint
            return acc
        }, {})
    }

    return input
}

/**
 * Return the info about the R1CS file.ù
 * @dev this method was built taking inspiration from
 * https://github.com/weijiekoh/circom-helper/blob/master/ts/read_num_inputs.ts#L5.
 * You can find the specs of R1CS file here
 * https://github.com/iden3/r1csfile/blob/master/doc/r1cs_bin_format.md
 * @param localR1CSFilePath <string> - the local path to the R1CS file.
 * @returns <CircuitMetadata> - the info about the R1CS file.
 */
export const getR1CSInfo = (localR1CSFilePath: string): CircuitMetadata => {
    /**
     *    ┏━━━━┳━━━━━━━━━━━━━━━━━┓
     *    ┃ 4  │   72 31 63 73   ┃     Magic  "r1cs"
     *    ┗━━━━┻━━━━━━━━━━━━━━━━━┛
     *    ┏━━━━┳━━━━━━━━━━━━━━━━━┓
     *    ┃ 4  │   01 00 00 00   ┃       Version 1
     *    ┗━━━━┻━━━━━━━━━━━━━━━━━┛
     *    ┏━━━━┳━━━━━━━━━━━━━━━━━┓
     *    ┃ 4  │   03 00 00 00   ┃       Number of Sections
     *    ┗━━━━┻━━━━━━━━━━━━━━━━━┛
     *    ┏━━━━┳━━━━━━━━━━━━━━━━━┳━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━┓
     *    ┃ 4  │ sectionType     ┃  8  │   SectionSize          ┃
     *    ┗━━━━┻━━━━━━━━━━━━━━━━━┻━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━┛
     *    ┏━━━━━━━━━━━━━━━━━━━━━┓
     *    ┃                     ┃
     *    ┃                     ┃
     *    ┃                     ┃
     *    ┃  Section Content    ┃
     *    ┃                     ┃
     *    ┃                     ┃
     *    ┃                     ┃
     *    ┗━━━━━━━━━━━━━━━━━━━━━┛
     *
     *    ┏━━━━┳━━━━━━━━━━━━━━━━━┳━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━┓
     *    ┃ 4  │ sectionType     ┃  8  │   SectionSize          ┃
     *    ┗━━━━┻━━━━━━━━━━━━━━━━━┻━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━┛
     *    ┏━━━━━━━━━━━━━━━━━━━━━┓
     *    ┃                     ┃
     *    ┃                     ┃
     *    ┃                     ┃
     *    ┃  Section Content    ┃
     *    ┃                     ┃
     *    ┃                     ┃
     *    ┃                     ┃
     *    ┗━━━━━━━━━━━━━━━━━━━━━┛
     *
     *     ...
     *     ...
     *     ...
     */

    // Prepare state.
    let pointer = 0 // selector to particular file data position in order to read data.
    let wires = 0
    let publicOutputs = 0
    let publicInputs = 0
    let privateInputs = 0
    let labels = 0
    let constraints = 0

    try {
        // Get 'number of section' (jump magic r1cs and version1 data).
        const numberOfSections = leBufferToBigint(readBytesFromFile(localR1CSFilePath, 0, 4, 8))

        // Jump to first section.
        pointer = 12

        // For each section
        for (let i = 0; i < numberOfSections; i++) {
            // Read section type.
            const sectionType = leBufferToBigint(readBytesFromFile(localR1CSFilePath, 0, 4, pointer))

            // Jump to section size.
            pointer += 4

            // Read section size
            const sectionSize = Number(leBufferToBigint(readBytesFromFile(localR1CSFilePath, 0, 8, pointer)))

            // If at header section (0x00000001 : Header Section).
            if (sectionType === BigInt(1)) {
                // Read info from header section.
                /**
                 *  ┏━━━━┳━━━━━━━━━━━━━━━━━┓
                 *  ┃ 4  │   20 00 00 00   ┃               Field Size in bytes (fs)
                 *  ┗━━━━┻━━━━━━━━━━━━━━━━━┛
                 *  ┏━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
                 *  ┃ fs │   010000f0 93f5e143 9170b979 48e83328 5d588181 b64550b8 29a031e1 724e6430 ┃  Prime size
                 *  ┗━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                 *  ┏━━━━┳━━━━━━━━━━━━━━━━━┓
                 *  ┃ 32 │   01 00 00 00   ┃               nWires
                 *  ┗━━━━┻━━━━━━━━━━━━━━━━━┛
                 *  ┏━━━━┳━━━━━━━━━━━━━━━━━┓
                 *  ┃ 32 │   01 00 00 00   ┃               nPubOut
                 *  ┗━━━━┻━━━━━━━━━━━━━━━━━┛
                 *  ┏━━━━┳━━━━━━━━━━━━━━━━━┓
                 *  ┃ 32 │   01 00 00 00   ┃               nPubIn
                 *  ┗━━━━┻━━━━━━━━━━━━━━━━━┛
                 *  ┏━━━━┳━━━━━━━━━━━━━━━━━┓
                 *  ┃ 32 │   01 00 00 00   ┃               nPrvIn
                 *  ┗━━━━┻━━━━━━━━━━━━━━━━━┛
                 *  ┏━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
                 *  ┃ 64 │   01 00 00 00 00 00 00 00   ┃   nLabels
                 *  ┗━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                 *  ┏━━━━┳━━━━━━━━━━━━━━━━━┓
                 *  ┃ 32 │   01 00 00 00   ┃               mConstraints
                 *  ┗━━━━┻━━━━━━━━━━━━━━━━━┛
                 */

                pointer += sectionSize - 20

                // Read R1CS info.
                wires = Number(leBufferToBigint(readBytesFromFile(localR1CSFilePath, 0, 4, pointer)))
                pointer += 4

                publicOutputs = Number(leBufferToBigint(readBytesFromFile(localR1CSFilePath, 0, 4, pointer)))
                pointer += 4

                publicInputs = Number(leBufferToBigint(readBytesFromFile(localR1CSFilePath, 0, 4, pointer)))
                pointer += 4

                privateInputs = Number(leBufferToBigint(readBytesFromFile(localR1CSFilePath, 0, 4, pointer)))
                pointer += 4

                labels = Number(leBufferToBigint(readBytesFromFile(localR1CSFilePath, 0, 8, pointer)))
                pointer += 8

                constraints = Number(leBufferToBigint(readBytesFromFile(localR1CSFilePath, 0, 4, pointer)))
            }

            pointer += 8 + Number(sectionSize)
        }

        return {
            curve: "bn-128", /// @note currently default to bn-128 as we support only Groth16 proving system.
            wires,
            constraints,
            privateInputs,
            publicInputs,
            labels,
            outputs: publicOutputs,
            pot: computeSmallestPowersOfTauForCircuit(constraints, publicOutputs)
        }
    } catch (err: any) {
        throw new Error(
            `The R1CS file you provided would not appear to be correct. Please, check that you have provided a valid R1CS file and repeat the process.`
        )
    }
}

/**
 * Parse and validate that the ceremony configuration is correct
 * @notice this does not upload any files to storage
 * @param path <string> - the path to the configuration file
 * @param cleanup <boolean> - whether to delete the r1cs file after parsing
 * @returns any - the data to pass to the cloud function for setup and the circuit artifacts
 */
export const parseCeremonyFile = async (path: string, cleanup: boolean = false): Promise<SetupCeremonyData> => {
    // check that the path exists
    if (!fs.existsSync(path))
        throw new Error(
            "The provided path to the configuration file does not exist. Please provide an absolute path and try again."
        )

    try {
        // read the data
        const data: CeremonySetupTemplate = JSON.parse(fs.readFileSync(path).toString())

        // verify that the data is correct
        if (
            data.timeoutMechanismType !== CeremonyTimeoutType.DYNAMIC &&
            data.timeoutMechanismType !== CeremonyTimeoutType.FIXED
        )
            throw new Error("Invalid timeout type. Please choose between DYNAMIC and FIXED.")

        // validate that we have at least 1 circuit input data
        if (!data.circuits || data.circuits.length === 0)
            throw new Error("You need to provide the data for at least 1 circuit.")

        // validate that the end date is in the future
        let endDate: Date
        let startDate: Date
        try {
            endDate = new Date(data.endDate)
            startDate = new Date(data.startDate)
        } catch (error: any) {
            throw new Error("The dates should follow this format: 2023-07-04T00:00:00.")
        }

        if (endDate <= startDate) throw new Error("The end date should be greater than the start date.")

        const currentDate = new Date()

        if (endDate <= currentDate || startDate <= currentDate)
            throw new Error("The start and end dates should be in the future.")

        // validate penalty
        if (data.penalty <= 0) throw new Error("The penalty should be greater than zero.")

        const circuits: CircuitDocument[] = []
        const urlPattern = /(https?:\/\/[^\s]+)/g
        const commitHashPattern = /^[a-f0-9]{40}$/i

        const circuitArtifacts: CeremonySetupTemplateCircuitArtifacts[] = []

        for (let i = 0; i < data.circuits.length; i++) {
            const circuitData = data.circuits[i]
            const { artifacts } = circuitData
            circuitArtifacts.push({
                artifacts
            })

            // where we storing the r1cs downloaded
            const localR1csPath = `./${circuitData.name}.r1cs`
            // where we storing the wasm downloaded
            const localWasmPath = `./${circuitData.name}.wasm`

            // download the r1cs to extract the metadata
            const streamPipeline = promisify(pipeline)

            // Make the call.
            const responseR1CS = await fetch(artifacts.r1csStoragePath)

            // Handle errors.
            if (!responseR1CS.ok && responseR1CS.status !== 200)
                throw new Error(
                    `There was an error while trying to download the r1cs file for circuit ${circuitData.name}. Please check that the file has the correct permissions (public) set.`
                )

            await streamPipeline(responseR1CS.body!, createWriteStream(localR1csPath))
            // Write the file locally

            // extract the metadata from the r1cs
            const metadata = getR1CSInfo(localR1csPath)

            // download wasm too to ensure it's available
            const responseWASM = await fetch(artifacts.wasmStoragePath)
            if (!responseWASM.ok && responseWASM.status !== 200)
                throw new Error(
                    `There was an error while trying to download the WASM file for circuit ${circuitData.name}. Please check that the file has the correct permissions (public) set.`
                )
            await streamPipeline(responseWASM.body!, createWriteStream(localWasmPath))

            // validate that the circuit hash and template links are valid
            const { template } = circuitData

            const URLMatch = template.source.match(urlPattern)
            if (!URLMatch || URLMatch.length === 0 || URLMatch.length > 1)
                throw new Error("You should provide the URL to the circuits templates on GitHub.")

            const hashMatch = template.commitHash.match(commitHashPattern)
            if (!hashMatch || hashMatch.length === 0 || hashMatch.length > 1)
                throw new Error("You should provide a valid commit hash of the circuit templates.")

            // calculate the hash of the r1cs file
            const r1csBlake2bHash = await blake512FromPath(localR1csPath)

            const circuitPrefix = extractPrefix(circuitData.name)

            // filenames
            const doubleDigitsPowers = convertToDoubleDigits(metadata.pot!)
            const r1csCompleteFilename = `${circuitData.name}.r1cs`
            const wasmCompleteFilename = `${circuitData.name}.wasm`
            const smallestPowersOfTauCompleteFilenameForCircuit = `${potFilenameTemplate}${doubleDigitsPowers}.ptau`
            const firstZkeyCompleteFilename = `${circuitPrefix}_${genesisZkeyIndex}.zkey`

            // storage paths
            const r1csStorageFilePath = getR1csStorageFilePath(circuitPrefix, r1csCompleteFilename)
            const wasmStorageFilePath = getWasmStorageFilePath(circuitPrefix, wasmCompleteFilename)
            const potStorageFilePath = getPotStorageFilePath(smallestPowersOfTauCompleteFilenameForCircuit)
            const zkeyStorageFilePath = getZkeyStorageFilePath(circuitPrefix, firstZkeyCompleteFilename)

            const files: any = {
                potFilename: smallestPowersOfTauCompleteFilenameForCircuit,
                r1csFilename: r1csCompleteFilename,
                wasmFilename: wasmCompleteFilename,
                initialZkeyFilename: firstZkeyCompleteFilename,
                potStoragePath: potStorageFilePath,
                r1csStoragePath: r1csStorageFilePath,
                wasmStoragePath: wasmStorageFilePath,
                initialZkeyStoragePath: zkeyStorageFilePath,
                r1csBlake2bHash
            }

            // validate that the compiler hash is a valid hash
            const { compiler } = circuitData
            const compilerHashMatch = compiler.commitHash.match(commitHashPattern)
            if (!compilerHashMatch || compilerHashMatch.length === 0 || compilerHashMatch.length > 1)
                throw new Error("You should provide a valid commit hash of the circuit compiler.")

            // validate that the verification options are valid
            const { verification } = circuitData
            if (verification.cfOrVm !== "CF" && verification.cfOrVm !== "VM")
                throw new Error("Please enter a valid verification mechanism: either CF or VM")

            // @todo VM parameters verification
            // if (verification['cfOrVM'] === "VM") {}

            // check that the timeout is provided for the correct configuration
            let dynamicThreshold: number | undefined
            let fixedTimeWindow: number | undefined

            let circuit: CircuitDocument | CircuitInputData = {} as CircuitDocument | CircuitInputData

            if (data.timeoutMechanismType === CeremonyTimeoutType.DYNAMIC) {
                if (circuitData.dynamicThreshold <= 0) throw new Error("The dynamic threshold should be > 0.")
                dynamicThreshold = circuitData.dynamicThreshold

                // the Circuit data for the ceremony setup
                circuit = {
                    name: circuitData.name,
                    description: circuitData.description,
                    prefix: circuitPrefix,
                    sequencePosition: i + 1,
                    metadata,
                    files,
                    template,
                    compiler,
                    verification,
                    dynamicThreshold,
                    avgTimings: {
                        contributionComputation: 0,
                        fullContribution: 0,
                        verifyCloudFunction: 0
                    }
                }
            }

            if (data.timeoutMechanismType === CeremonyTimeoutType.FIXED) {
                if (circuitData.fixedTimeWindow <= 0) throw new Error("The fixed time window threshold should be > 0.")
                fixedTimeWindow = circuitData.fixedTimeWindow

                // the Circuit data for the ceremony setup
                circuit = {
                    name: circuitData.name,
                    description: circuitData.description,
                    prefix: circuitPrefix,
                    sequencePosition: i + 1,
                    metadata,
                    files,
                    template,
                    compiler,
                    verification,
                    fixedTimeWindow,
                    avgTimings: {
                        contributionComputation: 0,
                        fullContribution: 0,
                        verifyCloudFunction: 0
                    }
                }
            }

            circuits.push(circuit)

            // remove the local r1cs and wasm downloads (if used for verifying the config only vs setup)
            if (cleanup) {
                fs.unlinkSync(localR1csPath)
                fs.unlinkSync(localWasmPath)
            }
        }

        const setupData: SetupCeremonyData = {
            ceremonyInputData: {
                title: data.title,
                description: data.description,
                startDate: startDate.valueOf(),
                endDate: endDate.valueOf(),
                timeoutMechanismType: data.timeoutMechanismType,
                penalty: data.penalty
            },
            ceremonyPrefix: extractPrefix(data.title),
            circuits,
            circuitArtifacts
        }

        return setupData
    } catch (error: any) {
        throw new Error(`Error while parsing up the ceremony setup file. ${error.message}`)
    }
}
