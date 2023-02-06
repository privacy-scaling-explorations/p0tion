#!/usr/bin/env node

import { zKey, r1cs } from "snarkjs"
import blake from "blakejs"
import boxen from "boxen"
import { Dirent, renameSync } from "fs"
import {
    isCoordinator,
    extractPrefix,
    commonTerms,
    potFilenameTemplate,
    genesisZkeyIndex,
    getR1csStorageFilePath,
    getPotStorageFilePath,
    getZkeyStorageFilePath,
    extractPoTFromFilename,
    potFileDownloadMainUrl,
    getBucketName,
    createS3Bucket,
    multiPartUpload,
    objectExist,
    setupCeremony
} from "@zkmpc/actions/src"
import { CeremonyTimeoutType } from "@zkmpc/actions/src/types/enums"
import {
    CeremonyInputData,
    CircomCompilerData,
    CircuitArtifacts,
    CircuitDocument,
    CircuitInputData,
    CircuitMetadata,
    CircuitTimings
} from "@zkmpc/actions/src/types"
import {
    convertToDoubleDigits,
    createCustomLoggerForFile,
    customSpinner,
    simpleLoader,
    sleep,
    terminate
} from "../lib/utils"
import {
    promptCeremonyInputData,
    promptCircomCompiler,
    promptCircuitInputData,
    askForConfirmation,
    promptCircuitSelector,
    promptSameCircomCompiler,
    promptCircuitAddition,
    promptPreComputedZkey,
    promptPreComputedZkeySelector,
    promptNeededPowersForCircuit,
    promptPotSelector,
    promptZkeyGeneration
} from "../lib/prompts"
import { COMMAND_ERRORS, showError } from "../lib/errors"
import { bootstrapCommandExecutionAndServices, checkAuth } from "../lib/services"
import {
    getCWDFilePath,
    getMetadataLocalFilePath,
    getPotLocalFilePath,
    getZkeyLocalFilePath,
    localPaths
} from "../lib/localConfigs"
import theme from "../lib/theme"
import {
    readFile,
    filterDirectoryFilesByExtension,
    directoryExists,
    cleanDir,
    getDirFilesSubPaths,
    downloadFileFromUrl,
    getFileStats
} from "../lib/files"

/**
 * Handle whatever is needed to obtain the input data for a circuit that the coordinator would like to add to the ceremony.
 * @param choosenCircuitFilename <string> - the name of the circuit to add.
 * @param ceremonyTimeoutMechanismType <CeremonyTimeoutType> - the type of ceremony timeout mechanism.
 * @param sameCircomCompiler <boolean> - true, if this circuit shares with the others the <CircomCompilerData>; otherwise false.
 * @param circuitSequencePosition <number> - the position of the circuit in the contribution queue.
 * @param sharedCircomCompilerData <string> - version and commit hash of the Circom compiler used to compile the ceremony circuits.
 * @returns <Promise<CircuitInputData>> - the input data of the circuit to add to the ceremony.
 */
const getInputDataToAddCircuitToCeremony = async (
    choosenCircuitFilename: string,
    ceremonyTimeoutMechanismType: CeremonyTimeoutType,
    sameCircomCompiler: boolean,
    circuitSequencePosition: number,
    sharedCircomCompilerData: CircomCompilerData
): Promise<CircuitInputData> => {
    // Prompt for circuit input data.
    const circuitInputData = await promptCircuitInputData(ceremonyTimeoutMechanismType, sameCircomCompiler)

    // Extract name and prefix.
    const circuitName = choosenCircuitFilename.substring(0, choosenCircuitFilename.indexOf("."))
    const circuitPrefix = extractPrefix(circuitName)

    // R1CS circuit file path.
    const r1csMetadataLocalFilePath = getMetadataLocalFilePath(
        `${circuitPrefix}_${commonTerms.foldersAndPathsTerms.metadata}.log`
    )
    const r1csCWDFilePath = getCWDFilePath(process.cwd(), choosenCircuitFilename)

    // Prepare a custom logger for R1CS metadata store (from snarkjs console to file).
    const logger = createCustomLoggerForFile(r1csMetadataLocalFilePath)

    const spinner = customSpinner(`Looking for circuit metadata...`, "clock")
    spinner.start()

    // Read R1CS and store metadata locally.
    // @todo need to investigate the behaviour of this info() method with huge circuits (could be a pain).
    await r1cs.info(r1csCWDFilePath, logger)

    await sleep(2000) // Sleep 2s to avoid unexpected termination (file descriptor close).

    spinner.succeed(`Circuit metadata read and saved correctly\n`)

    // Return updated data.
    return {
        ...circuitInputData,
        compiler: {
            commitHash:
                !circuitInputData.compiler.commitHash && sameCircomCompiler
                    ? sharedCircomCompilerData.commitHash
                    : circuitInputData.compiler.commitHash,
            version:
                !circuitInputData.compiler.version && sameCircomCompiler
                    ? sharedCircomCompilerData.version
                    : circuitInputData.compiler.version
        },
        name: circuitName,
        prefix: circuitPrefix,
        sequencePosition: circuitSequencePosition
    }
}

/**
 * Handle the addition of one or more circuits to the ceremony.
 * @param options <Array<string>> - list of possible circuits that can be added to the ceremony.
 * @param ceremonyTimeoutMechanismType <CeremonyTimeoutType> - the type of ceremony timeout mechanism.
 * @returns <Promise<Array<CircuitInputData>>> - the input data for each circuit that has been added to the ceremony.
 */
const handleAdditionOfCircuitsToCeremony = async (
    options: Array<string>,
    ceremonyTimeoutMechanismType: CeremonyTimeoutType
): Promise<Array<CircuitInputData>> => {
    // Prepare data.
    const circuitsInputData: Array<CircuitInputData> = [] // All circuits interactive data.
    let circuitSequencePosition = 1 // The circuit's position for contribution.
    let readyToSummarizeCeremony = false // Boolean flag to check whether the coordinator has finished to add circuits to the ceremony.
    let wannaAddAnotherCircuit = true // Loop flag.
    const sharedCircomCompilerData: CircomCompilerData = { version: "", commitHash: "" }

    // Prompt if the circuits to be added were compiled with the same version of Circom.
    // nb. CIRCOM compiler version/commit-hash is a declaration useful for later verifiability and avoid bugs.
    const sameCircomCompiler = await promptSameCircomCompiler()

    if (sameCircomCompiler) {
        // Prompt for Circom compiler.
        const { version, commitHash } = await promptCircomCompiler()

        sharedCircomCompilerData.version = version
        sharedCircomCompilerData.commitHash = commitHash
    }

    while (wannaAddAnotherCircuit) {
        // Gather information about the ceremony circuits.
        console.log(theme.text.bold(`\n- Circuit # ${theme.colors.magenta(`${circuitSequencePosition}`)}\n`))

        // Select one circuit among cwd circuits identified by R1CS files.
        const choosenCircuitFilename = await promptCircuitSelector(options)

        // Update list of possible options for next selection (if, any).
        options = options.filter((circuitFilename: string) => circuitFilename !== choosenCircuitFilename)

        // Get input data for choosen circuit.
        const circuitInputData = await getInputDataToAddCircuitToCeremony(
            choosenCircuitFilename,
            ceremonyTimeoutMechanismType,
            sameCircomCompiler,
            circuitSequencePosition,
            sharedCircomCompilerData
        )

        // Store circuit data.
        circuitsInputData.push(circuitInputData)

        // Check if any circuit is left for potentially addition to ceremony.
        if (options.length !== 0) {
            // Prompt for selection.
            const wannaAddNewCircuit = await promptCircuitAddition()

            if (wannaAddNewCircuit === false) readyToSummarizeCeremony = true // Terminate circuit addition.
            else circuitSequencePosition += 1 // Continue with next one.
        } else readyToSummarizeCeremony = true // No more circuit to add.

        // Summarize the ceremony.
        if (readyToSummarizeCeremony) wannaAddAnotherCircuit = false
    }

    return circuitsInputData
}

/**
 * Extract data contained in a logger-generated file containing information extracted from R1CS file read.
 * @notice useful for extracting metadata circuits contained in the generated file using a logger
 * on the `r1cs.info()` method of snarkjs.
 * @param fullFilePath <string> - the full path of the file.
 * @param keyRgx <RegExp> - the regular expression linked to the key from which you want to extract the value.
 * @returns <string> - the stringified extracted value.
 */
export const extractR1CSInfoValueForGivenKey = (fullFilePath: string, keyRgx: RegExp): string => {
    // Read the logger file.
    const fileContents = readFile(fullFilePath)

    // Check for the matching value.
    const matchingValue = fileContents.match(keyRgx)

    if (!matchingValue) showError(COMMAND_ERRORS.COMMAND_SETUP_NO_R1CS_INFO, true)

    // Elaborate spaces and special characters to extract the value.
    // nb. this is a manual process which follows this custom arbitrary extraction rule
    // accordingly to the output produced by the `r1cs.info()` method from snarkjs library.
    return matchingValue?.at(0)?.split(":")[1].replace(" ", "").split("#")[0].replace("\n", "")!
}

/**
 * Extract the metadata for a circuit.
 * @dev this method use the data extracted while reading the R1CS (r1cs.info) in the `getInputDataToAddCircuitToCeremony()` method.
 * @param circuitPrefix <string> - the prefix of the circuit.
 * @returns <CircuitMetadata> - the metadata of the circuit.
 */
const extractCircuitMetadata = (circuitPrefix: string): CircuitMetadata => {
    // Read file.
    const r1csMetadataFilePath = getMetadataLocalFilePath(`${circuitPrefix}_metadata.log`)

    // Extract info from file.
    const curve = extractR1CSInfoValueForGivenKey(r1csMetadataFilePath, /Curve: .+\n/s)
    const wires = Number(extractR1CSInfoValueForGivenKey(r1csMetadataFilePath, /# of Wires: .+\n/s))
    const constraints = Number(extractR1CSInfoValueForGivenKey(r1csMetadataFilePath, /# of Constraints: .+\n/s))
    const privateInputs = Number(extractR1CSInfoValueForGivenKey(r1csMetadataFilePath, /# of Private Inputs: .+\n/s))
    const publicInputs = Number(extractR1CSInfoValueForGivenKey(r1csMetadataFilePath, /# of Public Inputs: .+\n/s))
    const labels = Number(extractR1CSInfoValueForGivenKey(r1csMetadataFilePath, /# of Labels: .+\n/s))
    const outputs = Number(extractR1CSInfoValueForGivenKey(r1csMetadataFilePath, /# of Outputs: .+\n/s))

    // Minimum powers of tau needed for circuit.
    // nb. the estimation is useful for downloading the minimum associated PoT file when computing
    // the genesis zKey (if not provided).
    let power = 2
    let tau = 2 ** power

    while (constraints + outputs > tau) {
        power += 1
        tau = 2 ** power
    }

    // Return circuit metadata.
    return {
        curve,
        wires,
        constraints,
        privateInputs,
        publicInputs,
        labels,
        outputs,
        pot: power
    }
}

/**
 * Print ceremony and related circuits information.
 * @param ceremonyInputData <CeremonyInputData> - the input data of the ceremony.
 * @param circuits <Array<CircuitDocument>> - the circuit documents associated to the circuits of the ceremony.
 */
const displayCeremonySummary = (ceremonyInputData: CeremonyInputData, circuits: Array<CircuitDocument>) => {
    // Prepare ceremony summary.
    let summary = `${`${theme.text.bold(ceremonyInputData.title)}\n${theme.text.italic(ceremonyInputData.description)}`}
        \n${`Opening: ${theme.text.bold(
            theme.text.underlined(new Date(ceremonyInputData.startDate).toUTCString().replace("GMT", "UTC"))
        )}\nEnding: ${theme.text.bold(
            theme.text.underlined(new Date(ceremonyInputData.endDate).toUTCString().replace("GMT", "UTC"))
        )}`}
        \n${theme.text.bold(
            ceremonyInputData.timeoutMechanismType === CeremonyTimeoutType.DYNAMIC ? `Dynamic` : `Fixed`
        )} Timeout / ${theme.text.bold(ceremonyInputData.penalty)}m Penalty`

    for (const circuit of circuits) {
        // Append circuit summary.
        summary += `\n\n${theme.text.bold(
            `- CIRCUIT # ${theme.text.bold(theme.colors.magenta(`${circuit.sequencePosition}`))}`
        )}
      \n${`${theme.text.bold(circuit.name)}\n${theme.text.italic(circuit.description)}
      \nCurve: ${theme.text.bold(circuit.metadata?.curve)}\nCompiler: ${theme.text.bold(
          `${circuit.compiler.version}`
      )} (${theme.text.bold(circuit.compiler.commitHash.slice(0, 7))})\nSource: ${theme.text.bold(
          circuit.template.source.split(`/`).at(-1)
      )}(${theme.text.bold(circuit.template.paramsConfiguration)})\n${
          ceremonyInputData.timeoutMechanismType === CeremonyTimeoutType.DYNAMIC
              ? `Threshold: ${theme.text.bold(circuit.dynamicThreshold)}%`
              : `Max Contribution Time: ${theme.text.bold(circuit.fixedTimeWindow)}m`
      }
      \n# Wires: ${theme.text.bold(circuit.metadata?.wires)}\n# Constraints: ${theme.text.bold(
          circuit.metadata?.constraints
      )}\n# Private Inputs: ${theme.text.bold(circuit.metadata?.privateInputs)}\n# Public Inputs: ${theme.text.bold(
          circuit.metadata?.publicInputs
      )}\n# Labels: ${theme.text.bold(circuit.metadata?.labels)}\n# Outputs: ${theme.text.bold(
          circuit.metadata?.outputs
      )}\n# PoT: ${theme.text.bold(circuit.metadata?.pot)}`}`
    }

    // Display complete summary.
    console.log(
        boxen(summary, {
            title: theme.colors.magenta(`CEREMONY SUMMARY`),
            titleAlignment: "center",
            textAlignment: "left",
            margin: 1,
            padding: 1
        })
    )
}

/**
 * Setup command.
 * @notice The setup command allows the coordinator of the ceremony to prepare the next ceremony by interacting with the CLI.
 * @dev For proper execution, the command must be run in a folder containing the R1CS files related to the circuits
 * for which the coordinator wants to create the ceremony. The command will download the necessary Tau powers
 * from Hermez's ceremony Phase 1 Reliable Setup Ceremony.
 */
const setup = async () => {
    // Setup command state.
    let circuitsInputData: Array<CircuitInputData> = [] // All circuits interactive data.
    const circuits: Array<CircuitDocument> = [] // Circuits.

    const { firebaseApp, firebaseFunctions, firestoreDatabase } = await bootstrapCommandExecutionAndServices()

    // Check for authentication.
    const { user, handle } = await checkAuth(firebaseApp)

    // Preserve command execution only for coordinators.
    if (!(await isCoordinator(user))) showError(COMMAND_ERRORS.COMMAND_NOT_COORDINATOR, true)

    // Get current working directory.
    const cwd = process.cwd()

    console.log(
        `${theme.symbols.warning} To setup a zkSNARK Groth16 Phase 2 Trusted Setup ceremony you need to have the Rank-1 Constraint System (R1CS) file for each circuit in your working directory`
    )
    console.log(
        `\n${theme.symbols.info} Your current working directory is ${theme.text.bold(
            theme.text.underlined(process.cwd())
        )}\n`
    )

    // Look for R1CS files.
    const r1csFilePaths = await filterDirectoryFilesByExtension(cwd, `.r1cs`)
    // Look for pre-computed zKeys references (if any).
    const localPreComputedZkeysFilenames = await filterDirectoryFilesByExtension(cwd, `.zkey`)

    if (!r1csFilePaths.length) showError(COMMAND_ERRORS.COMMAND_SETUP_NO_R1CS, true)

    // Prepare local directories.
    if (!directoryExists(localPaths.output)) cleanDir(localPaths.output)
    cleanDir(localPaths.setup)
    cleanDir(localPaths.pot)
    cleanDir(localPaths.metadata)
    cleanDir(localPaths.zkeys)

    // Prompt the coordinator for gather ceremony input data.
    const ceremonyInputData = await promptCeremonyInputData(firestoreDatabase)
    const ceremonyPrefix = extractPrefix(ceremonyInputData.title)

    process.stdout.write(`\n`)

    // Add circuits to ceremony.
    circuitsInputData = await handleAdditionOfCircuitsToCeremony(
        r1csFilePaths.map((dirent: Dirent) => dirent.name),
        ceremonyInputData.timeoutMechanismType
    )

    let spinner = customSpinner(`Summarizing your ceremony...`, "clock")
    spinner.start()

    // Extract circuits metadata.
    for (const circuitInputData of circuitsInputData) {
        const circuitMetadata = extractCircuitMetadata(circuitInputData.prefix!)

        circuits.push({
            ...circuitInputData,
            metadata: circuitMetadata
        })
    }

    spinner.stop()

    // Display ceremony summary.
    displayCeremonySummary(ceremonyInputData, circuits)

    // Prepare data.
    let wannaGenerateNewZkey = true // New zKey generation flag.
    let wannaUsePreDownloadedPoT = false // Local PoT file usage flag.
    let bucketName: string = "" // The name of the bucket.

    // Ask for confirmation.
    const { confirmation } = await askForConfirmation("Do you want to continue with the ceremony setup?", "Yes", "No")

    if (confirmation) {
        await simpleLoader(`Looking for any pre-computed zkey file...`, `clock`, 1000)

        // Simulate pre-computed zkeys search.
        let leftPreComputedZkeys = localPreComputedZkeysFilenames

        /** Circuit-based setup */
        for (let i = 0; i < circuits.length; i += 1) {
            const circuit = circuits[i]

            console.log(
                theme.text.bold(`\n- Setup for Circuit # ${theme.colors.magenta(`${circuit.sequencePosition}`)}\n`)
            )

            // Convert to double digits powers (e.g., 9 -> 09).
            let doubleDigitsPowers = convertToDoubleDigits(circuit.metadata?.pot!)
            let smallestPowersOfTauForCircuit = `${potFilenameTemplate}${doubleDigitsPowers}.ptau`

            // Rename R1Cs and zKey based on circuit name and prefix.
            const r1csCompleteFilename = `${circuit.name}.r1cs`
            const firstZkeyCompleteFilename = `${circuit.prefix}_${genesisZkeyIndex}.zkey`
            let preComputedZkeyCompleteFilename = ``

            // Local.
            const r1csLocalPathAndFileName = getCWDFilePath(cwd, r1csCompleteFilename)
            let potLocalPathAndFileName = getPotLocalFilePath(smallestPowersOfTauForCircuit)
            let zkeyLocalPathAndFileName = getZkeyLocalFilePath(firstZkeyCompleteFilename)

            // Storage.
            const r1csStorageFilePath = getR1csStorageFilePath(circuit.prefix!, r1csCompleteFilename)
            let potStorageFilePath = getPotStorageFilePath(smallestPowersOfTauForCircuit)
            const zkeyStorageFilePath = getZkeyStorageFilePath(circuit.prefix!, firstZkeyCompleteFilename)

            if (leftPreComputedZkeys.length <= 0)
                console.log(
                    `${theme.symbols.warning} No pre-computed zKey was found. Therefore, a new zKey from scratch will be generated.`
                )
            else {
                // Prompt if coordinator wanna use a pre-computed zKey for the circuit.
                const wannaUsePreComputedZkey = await promptPreComputedZkey()

                if (wannaUsePreComputedZkey) {
                    // Prompt for pre-computed zKey selection.
                    const preComputedZkeyOptions = leftPreComputedZkeys.map((dirent: Dirent) => dirent.name)
                    preComputedZkeyCompleteFilename = await promptPreComputedZkeySelector(preComputedZkeyOptions)

                    // Switch to pre-computed zkey path.
                    zkeyLocalPathAndFileName = getCWDFilePath(cwd, preComputedZkeyCompleteFilename)

                    // Switch the flag.
                    wannaGenerateNewZkey = false
                }
            }

            // Check for PoT file associated to selected pre-computed zKey.
            if (!wannaGenerateNewZkey) {
                spinner.text = "Looking for Powers of Tau files..."
                spinner.start()

                const potFilePaths = await filterDirectoryFilesByExtension(cwd, `.ptau`)

                const potOptions: Array<string> = potFilePaths
                    .filter((dirent: Dirent) => extractPoTFromFilename(dirent.name) >= circuit.metadata?.pot!)
                    .map((dirent: Dirent) => dirent.name)

                if (potOptions.length <= 0) {
                    spinner.warn(`No Powers of Tau file was found.`)

                    // Download the PoT from remote server.
                    const choosenPowers = await promptNeededPowersForCircuit(circuit.metadata?.pot!)

                    // Convert to double digits powers (e.g., 9 -> 09).
                    doubleDigitsPowers = convertToDoubleDigits(choosenPowers)
                    smallestPowersOfTauForCircuit = `${potFilenameTemplate}${doubleDigitsPowers}.ptau`

                    // Override.
                    potLocalPathAndFileName = getPotLocalFilePath(smallestPowersOfTauForCircuit)
                    potStorageFilePath = getPotStorageFilePath(smallestPowersOfTauForCircuit)
                } else {
                    spinner.stop()

                    // Prompt for Powers of Tau selection among local files.
                    smallestPowersOfTauForCircuit = await promptPotSelector(potOptions)

                    // Update.
                    doubleDigitsPowers = convertToDoubleDigits(extractPoTFromFilename(smallestPowersOfTauForCircuit))

                    // Switch to new ptau path.
                    potLocalPathAndFileName = getPotLocalFilePath(smallestPowersOfTauForCircuit)
                    potStorageFilePath = getPotStorageFilePath(smallestPowersOfTauForCircuit)

                    wannaUsePreDownloadedPoT = true
                }
            }

            // Check if the smallest pot has been already downloaded.
            const downloadedPotFiles = await getDirFilesSubPaths(localPaths.pot)
            const appropriatePotFiles: Array<string> = downloadedPotFiles
                .filter((dirent: Dirent) => extractPoTFromFilename(dirent.name) === Number(doubleDigitsPowers))
                .map((dirent: Dirent) => dirent.name)

            if (appropriatePotFiles.length <= 0 || !wannaUsePreDownloadedPoT) {
                spinner.text = `Downloading the ${theme.text.bold(
                    `#${doubleDigitsPowers}`
                )} PoT from the Hermez Cryptography Phase 1 Trusted Setup...`
                spinner.start()

                // Prepare for downloading.
                const potDownloadUrl = `${potFileDownloadMainUrl}${smallestPowersOfTauForCircuit}`
                const destFilePath = getPotLocalFilePath(smallestPowersOfTauForCircuit)

                // Download Powers of Tau file from remote server.
                await downloadFileFromUrl(destFilePath, potDownloadUrl)

                spinner.succeed(`Powers of tau ${theme.text.bold(`#${doubleDigitsPowers}`)} downloaded successfully`)
            } else
                console.log(
                    `${theme.symbols.success} Powers of Tau ${theme.text.bold(
                        `#${doubleDigitsPowers}`
                    )} already downloaded`
                )

            // Check to avoid to upload a wrong combination of R1CS, PoT and pre-computed zKey file.
            if (!wannaGenerateNewZkey) {
                console.log(
                    `${theme.symbols.info} Checking the pre-computed zKey locally on your machine (to avoid any R1CS, PoT, zKey combination errors)`
                )

                // Verification.
                const valid = await zKey.verifyFromR1cs(
                    r1csLocalPathAndFileName,
                    potLocalPathAndFileName,
                    zkeyLocalPathAndFileName,
                    console
                )

                await sleep(3000) // workaround for unexpected file descriptor close.

                if (valid) {
                    console.log(`${theme.symbols.success} The pre-computed zKey you have provided is valid`)

                    // Update the pre-computed zKey list of options.
                    leftPreComputedZkeys = leftPreComputedZkeys.filter(
                        (dirent: Dirent) => dirent.name !== preComputedZkeyCompleteFilename
                    )

                    // Rename following the conventions.
                    renameSync(getCWDFilePath(cwd, preComputedZkeyCompleteFilename), firstZkeyCompleteFilename)

                    // Update local path.
                    zkeyLocalPathAndFileName = getCWDFilePath(cwd, firstZkeyCompleteFilename)
                } else {
                    console.log(`${theme.symbols.error} The pre-computed zKey you have provided is invalid`)

                    // Prompt to generate a new zKey from scratch.
                    const newZkeyGeneration = await promptZkeyGeneration()

                    if (!newZkeyGeneration) showError(COMMAND_ERRORS.COMMAND_SETUP_ABORT, true)
                    else wannaGenerateNewZkey = true
                }
            }

            // Generate a brand new zKey from scratch.
            if (wannaGenerateNewZkey) {
                console.log(
                    `${theme.symbols.info} The computation of your brand new zKey is starting soon.\n${theme.text.bold(
                        `${theme.symbols.warning} Be careful, stopping the process will result in the loss of all progress achieved so far.`
                    )}`
                )

                // Generate zKey.
                await zKey.newZKey(r1csLocalPathAndFileName, potLocalPathAndFileName, zkeyLocalPathAndFileName, console)

                console.log(
                    `\n${theme.symbols.success} Generation of genesis zKey (${theme.text.bold(
                        firstZkeyCompleteFilename
                    )}) completed successfully`
                )
            }

            /** STORAGE BUCKET UPLOAD */
            if (!bucketName) {
                // Create a new S3 bucket.
                bucketName = getBucketName(ceremonyPrefix, process.env.CONFIG_CEREMONY_BUCKET_POSTFIX!)

                spinner = customSpinner(`Getting ready for ceremony files and data storage...`, `clock`)
                spinner.start()

                // @todo should handle return value
                await createS3Bucket(firebaseFunctions, bucketName)

                spinner.succeed(`Storage and DB services ready`)
            }

            // zKey.
            spinner.text = `Uploading genesis zKey file to ceremony storage...`
            spinner.start()

            await multiPartUpload(
                firebaseFunctions,
                bucketName,
                zkeyStorageFilePath,
                zkeyLocalPathAndFileName,
                String(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB),
                Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS)
            )

            spinner.succeed(
                `Upload of genesis zKey (${theme.text.bold(firstZkeyCompleteFilename)}) file completed successfully`
            )

            // PoT.
            // Check if the Powers of Tau file has been already uploaded on the storage.
            const alreadyUploadedPot = await objectExist(
                firebaseFunctions,
                bucketName,
                getPotStorageFilePath(smallestPowersOfTauForCircuit)
            )

            if (!alreadyUploadedPot) {
                spinner.text = `Uploading Powers of Tau file to ceremony storage...`
                spinner.start()

                // Upload.
                await multiPartUpload(
                    firebaseFunctions,
                    bucketName,
                    potStorageFilePath,
                    potLocalPathAndFileName,
                    String(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB),
                    Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS)
                )

                spinner.succeed(
                    `Upload of Powers of Tau (${theme.text.bold(
                        smallestPowersOfTauForCircuit
                    )}) file completed successfully`
                )
            } else
                console.log(
                    `${theme.symbols.success} The Powers of Tau (${theme.text.bold(
                        smallestPowersOfTauForCircuit
                    )}) file is already saved in the storage`
                )

            // R1CS.
            spinner.text = `Uploading R1CS file to ceremony storage...`
            spinner.start()

            await multiPartUpload(
                firebaseFunctions,
                bucketName,
                r1csStorageFilePath,
                r1csLocalPathAndFileName,
                String(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB),
                Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS)
            )

            spinner.succeed(`Upload of R1CS (${theme.text.bold(r1csCompleteFilename)}) file completed successfully`)

            /** FIRESTORE DB */
            const circuitFiles: CircuitArtifacts = {
                r1csFilename: r1csCompleteFilename,
                potFilename: smallestPowersOfTauForCircuit,
                initialZkeyFilename: firstZkeyCompleteFilename,
                r1csStoragePath: r1csStorageFilePath,
                potStoragePath: potStorageFilePath,
                initialZkeyStoragePath: zkeyStorageFilePath,
                r1csBlake2bHash: blake.blake2bHex(r1csStorageFilePath),
                potBlake2bHash: blake.blake2bHex(potStorageFilePath),
                initialZkeyBlake2bHash: blake.blake2bHex(zkeyStorageFilePath)
            }

            // nb. these will be validated after the first contribution.
            const circuitTimings: CircuitTimings = {
                contributionComputation: 0,
                fullContribution: 0,
                verifyCloudFunction: 0
            }

            circuits[i] = {
                ...circuit,
                files: circuitFiles,
                avgTimings: circuitTimings,
                zKeySizeInBytes: getFileStats(zkeyLocalPathAndFileName).size
            }

            // Reset flags.
            wannaGenerateNewZkey = true
            wannaUsePreDownloadedPoT = false
        }

        process.stdout.write(`\n`)

        spinner.text = `Uploading ceremony data to database...`
        spinner.start()

        // Call cloud function for checking and storing ceremony data on Firestore db.
        await setupCeremony(firebaseFunctions, ceremonyInputData, ceremonyPrefix, circuits)

        await sleep(3000) // Cloud function termination workaround.

        spinner.succeed(
            `Congratulations, the setup of ceremony ${theme.text.bold(
                ceremonyInputData.title
            )} has been successfully completed ${
                theme.emojis.tada
            }. You will be able to find all the files and info respectively in the ceremony bucket and database document.`
        )
    }
    terminate(handle)
}

export default setup
