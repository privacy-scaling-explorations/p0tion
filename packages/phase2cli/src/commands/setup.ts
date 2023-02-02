#!/usr/bin/env node

import { zKey, r1cs } from "snarkjs"
import blake from "blakejs"
import boxen from "boxen"
import { Dirent, renameSync } from "fs"
import {
    isCoordinator,
    extractPrefix,
    commonTerms,
    getCircuitMetadataFromR1csFile,
    estimatePoT,
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
import { CircuitArtifacts, CircuitDocument, CircuitInputData, CircuitTimings } from "@zkmpc/actions/src/types"
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
 * Setup command.
 * @notice The setup command allows the coordinator of the ceremony to prepare the next ceremony by interacting with the CLI.
 * @dev For proper execution, the command must be run in a folder containing the R1CS files related to the circuits
 * for which the coordinator wants to create the ceremony. The command will download the necessary Tau powers
 * from Hermez's ceremony Phase 1 Reliable Setup Ceremony.
 */
const setup = async () => {
    // Setup command state.
    let circuitSequencePosition = 1 // The circuit's position for contribution.
    let sharedCircomVersion: string = ""
    let sharedCircomCommitHash: string = ""
    let readyToSummarizeCeremony = false // Boolean flag to check whether the coordinator has finished to add circuits to the ceremony.

    // Circuits.
    const circuitsInputData: Array<CircuitInputData> = [] // All circuits input data.
    const circuits: Array<CircuitDocument> = []

    const { firebaseApp, firebaseFunctions, firestoreDatabase } = await bootstrapCommandExecutionAndServices()

    // Check for authentication.
    const { user, handle } = await checkAuth(firebaseApp)

    // Preserve command execution only for coordinators].
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

    // Ask for CIRCOM compiler version/commit-hash declaration for later verifiability.
    const sameCircomCompiler = await promptSameCircomCompiler()

    if (sameCircomCompiler) {
        // Prompt for Circom compiler.
        const { version, commitHash } = await promptCircomCompiler()

        sharedCircomVersion = version
        sharedCircomCommitHash = commitHash
    }

    // Prepare data.
    let options = r1csFilePaths.map((dirent: Dirent) => dirent.name)
    let wannaAddAnotherCircuit = true // Loop flag.
    let wannaGenerateNewZkey = true // New zKey generation flag.
    let wannaUsePreDownloadedPoT = false // Local PoT file usage flag.
    let spinner = customSpinner(`custom`, "clock")
    let bucketName: string = "" // The name of the bucket.

    while (wannaAddAnotherCircuit) {
        // Gather information about the ceremony circuits.
        console.log(theme.text.bold(`\n- Circuit # ${theme.colors.magenta(`${circuitSequencePosition}`)}\n`))

        // Select one circuit among cwd circuits identified by R1CS files.
        const choosenCircuitFilename = await promptCircuitSelector(options)

        // Prompt for circuit input data.
        const circuitInputData = await promptCircuitInputData(
            ceremonyInputData.timeoutMechanismType,
            sameCircomCompiler
        )

        // Extract name and prefix.
        const circuitName = choosenCircuitFilename.substring(0, choosenCircuitFilename.indexOf("."))
        const circuitPrefix = extractPrefix(circuitName)

        // R1CS circuit file path.
        const r1csMetadataLocalFilePath = getMetadataLocalFilePath(
            `${circuitPrefix}_${commonTerms.foldersAndPathsTerms.metadata}.log`
        )
        const r1csCWDFilePath = getCWDFilePath(cwd, choosenCircuitFilename)

        // Prepare a custom logger for R1CS metadata store (from snarkjs console to file).
        const logger = createCustomLoggerForFile(r1csMetadataLocalFilePath)

        spinner.text = "Looking for circuit metadata..."
        spinner.start()

        // Read R1CS and store metadata locally.
        // @todo need to investigate the behaviour of this info() method with huge circuits (could be a pain).
        await r1cs.info(r1csCWDFilePath, logger)

        await sleep(2000) // Sleep 2s to avoid unexpected termination (file descriptor close).

        spinner.succeed(`Circuit metadata read and saved correctly\n`)

        // Store circuit data.
        circuitsInputData.push({
            ...circuitInputData,
            compiler: {
                commitHash:
                    !circuitInputData.compiler.commitHash && sameCircomCompiler
                        ? sharedCircomCommitHash
                        : circuitInputData.compiler.commitHash,
                version:
                    !circuitInputData.compiler.version && sameCircomCompiler
                        ? sharedCircomVersion
                        : circuitInputData.compiler.version
            },
            name: circuitName,
            prefix: circuitPrefix,
            sequencePosition: circuitSequencePosition
        })

        // Update list of possible options for next selection (if, any).
        options = options.filter((circuitFilename: string) => circuitFilename !== choosenCircuitFilename)

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

    // Simulate loading.
    await simpleLoader(`Summarizing your ceremony...`, `clock`, 2000)

    // Display ceremony summary.
    let summary = `${`${theme.text.bold(ceremonyInputData.title)}\n${theme.text.italic(ceremonyInputData.description)}`}
    \n${`Opening: ${theme.text.bold(
        theme.text.underlined(new Date(ceremonyInputData.startDate).toUTCString().replace("GMT", "UTC"))
    )}\nEnding: ${theme.text.bold(
        theme.text.underlined(new Date(ceremonyInputData.endDate).toUTCString().replace("GMT", "UTC"))
    )}`}
    \n${theme.text.bold(
        ceremonyInputData.timeoutMechanismType === CeremonyTimeoutType.DYNAMIC ? `Dynamic` : `Fixed`
    )} Timeout / ${theme.text.bold(ceremonyInputData.penalty)}m Penalty`

    for (let i = 0; i < circuitsInputData.length; i += 1) {
        const circuitInputData = circuitsInputData[i]

        // Read file.
        const r1csMetadataFilePath = getMetadataLocalFilePath(`${circuitInputData.prefix}_metadata.log`)
        const circuitMetadata = readFile(r1csMetadataFilePath)

        // Extract info from file.
        const curve = getCircuitMetadataFromR1csFile(circuitMetadata, /Curve: .+\n/s)
        const wires = Number(getCircuitMetadataFromR1csFile(circuitMetadata, /# of Wires: .+\n/s))
        const constraints = Number(getCircuitMetadataFromR1csFile(circuitMetadata, /# of Constraints: .+\n/s))
        const privateInputs = Number(getCircuitMetadataFromR1csFile(circuitMetadata, /# of Private Inputs: .+\n/s))
        const publicInputs = Number(getCircuitMetadataFromR1csFile(circuitMetadata, /# of Public Inputs: .+\n/s))
        const labels = Number(getCircuitMetadataFromR1csFile(circuitMetadata, /# of Labels: .+\n/s))
        const outputs = Number(getCircuitMetadataFromR1csFile(circuitMetadata, /# of Outputs: .+\n/s))

        const pot = estimatePoT(constraints, outputs)

        // Store info.
        circuits.push({
            ...circuitInputData,
            metadata: {
                curve,
                wires,
                constraints,
                privateInputs,
                publicInputs,
                labels,
                outputs,
                pot
            }
        })

        // Append circuit summary.
        summary += `\n\n${theme.text.bold(
            `- CIRCUIT # ${theme.text.bold(theme.colors.magenta(`${circuitInputData.sequencePosition}`))}`
        )}
  \n${`${theme.text.bold(circuitInputData.name)}\n${theme.text.italic(circuitInputData.description)}
  \nCurve: ${theme.text.bold(curve)}\nCompiler: ${theme.text.bold(
      `${circuitInputData.compiler.version}`
  )} (${theme.text.bold(circuitInputData.compiler.commitHash?.slice(0, 7))})\nSource: ${theme.text.bold(
      circuitInputData.template.source.split(`/`).at(-1)
  )}(${theme.text.bold(circuitInputData.template.paramsConfiguration)})\n${
      ceremonyInputData.timeoutMechanismType === CeremonyTimeoutType.DYNAMIC
          ? `Threshold: ${theme.text.bold(circuitInputData.dynamicThreshold)}%`
          : `Max Contribution Time: ${theme.text.bold(circuitInputData.fixedTimeWindow)}m`
  }
  \n# Wires: ${theme.text.bold(wires)}\n# Constraints: ${theme.text.bold(
      constraints
  )}\n# Private Inputs: ${theme.text.bold(privateInputs)}\n# Public Inputs: ${theme.text.bold(
      publicInputs
  )}\n# Labels: ${theme.text.bold(labels)}\n# Outputs: ${theme.text.bold(outputs)}\n# PoT: ${theme.text.bold(pot)}`}`
    }

    // Show ceremony summary.
    console.log(
        boxen(summary, {
            title: theme.colors.magenta(`CEREMONY SUMMARY`),
            titleAlignment: "center",
            textAlignment: "left",
            margin: 1,
            padding: 1
        })
    )

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
            let doubleDigitsPowers = convertToDoubleDigits(circuit.metadata.pot)
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
                    .filter((dirent: Dirent) => extractPoTFromFilename(dirent.name) >= circuit.metadata.pot)
                    .map((dirent: Dirent) => dirent.name)

                if (potOptions.length <= 0) {
                    spinner.warn(`No Powers of Tau file was found.`)

                    // Download the PoT from remote server.
                    const choosenPowers = await promptNeededPowersForCircuit(circuit.metadata.pot)

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
