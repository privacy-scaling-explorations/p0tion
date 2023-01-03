#!/usr/bin/env node

import { zKey, r1cs } from "snarkjs"
import winston from "winston"
import blake from "blakejs"
import boxen from "boxen"
import { Dirent, renameSync } from "fs"
import {
    getCircuitMetadataFromR1csFile,
    estimatePoT,
    getBucketName,
    createS3Bucket,
    objectExist,
    multiPartUpload,
    setupCeremony,
    extractPoTFromFilename,
    extractPrefix
} from "@zkmpc/actions"
import {
    theme,
    symbols,
    emojis,
    potFilenameTemplate,
    potDownloadUrlTemplate,
    paths,
    names,
    collections
} from "../lib/constants"
import { handleCurrentAuthUserSignIn, onlyCoordinator } from "../lib/auth"
import {
    bootstrapCommandExec,
    convertToDoubleDigits,
    customSpinner,
    simpleLoader,
    sleep,
    terminate
} from "../lib/utils"
import {
    askCeremonyInputData,
    askCircomCompilerVersionAndCommitHash,
    askCircuitInputData,
    askForCircuitSelectionFromLocalDir,
    askForConfirmation,
    askForPtauSelectionFromLocalDir,
    askForZkeySelectionFromLocalDir,
    askPowersOftau
} from "../lib/prompts"
import {
    cleanDir,
    directoryExists,
    downloadFileFromUrl,
    getDirFilesSubPaths,
    getFileStats,
    readFile
} from "../lib/files"
import { CeremonyTimeoutType, Circuit, CircuitFiles, CircuitInputData, CircuitTimings } from "../../types/index"
import { GENERIC_ERRORS, showError } from "../lib/errors"

/**
 * Return the files from the current working directory which have the extension specified as input.
 * @param cwd <string> - the current working directory.
 * @param ext <string> - the file extension.
 * @returns <Promise<Array<Dirent>>>
 */
const getSpecifiedFilesFromCwd = async (cwd: string, ext: string): Promise<Array<Dirent>> => {
    // Check if the current directory contains the .r1cs files.
    const cwdFiles = await getDirFilesSubPaths(cwd)
    const cwdExtFiles = cwdFiles.filter((file: Dirent) => file.name.includes(ext))

    return cwdExtFiles
}

/**
 * Handle one or more circuit addition for the specified ceremony.
 * @param cwd <string> - the current working directory.
 * @param cwdR1csFiles <Array<Dirent>> - the list of R1CS files in the current working directory.
 * @param timeoutMechanismType <CeremonyTimeoutType> - the choosen timeout mechanism type for the ceremony.
 * @param isCircomVersionEqualAmongCircuits <boolean> - true if the circom compiler version is equal among circuits; otherwise false.
 * @returns <Promise<Array<CircuitInputData>>>
 */
const handleCircuitsAddition = async (
    cwd: string,
    cwdR1csFiles: Array<Dirent>,
    timeoutMechanismType: CeremonyTimeoutType,
    isCircomVersionEqualAmongCircuits: boolean
): Promise<Array<CircuitInputData>> => {
    const circuitsInputData: Array<CircuitInputData> = []

    let wannaAddAnotherCircuit = true // Loop flag.
    let circuitSequencePosition = 1 // Sequential circuit position for handling the contributions queue for the ceremony.
    let leftCircuits: Array<Dirent> = cwdR1csFiles

    // Clear directory.
    cleanDir(paths.metadataPath)

    while (wannaAddAnotherCircuit) {
        console.log(theme.bold(`\n- Circuit # ${theme.magenta(`${circuitSequencePosition}`)}\n`))

        // Interactively select a circuit.
        const circuitNameWithExt = await askForCircuitSelectionFromLocalDir(leftCircuits)

        // Remove the selected circuit from the list.
        leftCircuits = leftCircuits.filter((dirent: Dirent) => dirent.name !== circuitNameWithExt)

        // Ask for circuit input data.
        const circuitInputData = await askCircuitInputData(timeoutMechanismType, isCircomVersionEqualAmongCircuits)

        // Remove .r1cs file extension.
        const circuitName = circuitNameWithExt.substring(0, circuitNameWithExt.indexOf("."))
        const circuitPrefix = extractPrefix(circuitName)

        // R1CS circuit file path.
        const r1csMetadataFilePath = `${paths.metadataPath}/${circuitPrefix}_${names.metadata}.log`
        const r1csFilePath = `${cwd}/${circuitName}.r1cs`

        // Custom logger for R1CS metadata save.
        const logger = winston.createLogger({
            level: "info",
            transports: new winston.transports.File({
                filename: r1csMetadataFilePath,
                format: winston.format.printf((log) => log.message),
                level: "info"
            })
        })

        const metadataSpinner = customSpinner(`Looking for metadata...`, "clock")
        metadataSpinner.start()

        // Read .r1cs file and log/store info.
        await r1cs.info(r1csFilePath, logger)

        // Sleep to avoid logger unexpected termination.
        await sleep(1000)

        // Store data.
        circuitsInputData.push({
            ...circuitInputData,
            name: circuitName,
            prefix: circuitPrefix,
            sequencePosition: circuitSequencePosition
        })

        metadataSpinner.succeed(
            `Metadata stored in your working directory ${theme.bold(
                theme.underlined(r1csMetadataFilePath.substring(1))
            )}\n`
        )

        let readyToAssembly = false

        // In case of negative confirmation or no more circuits left.
        if (leftCircuits.length !== 0) {
            // Ask for another circuit.
            const { confirmation: wannaAddNewCircuit } = await askForConfirmation(
                "Want to add another circuit for the ceremony?",
                "Okay",
                "No"
            )

            if (wannaAddNewCircuit === undefined) showError(GENERIC_ERRORS.GENERIC_DATA_INPUT, true)

            if (wannaAddNewCircuit === false) readyToAssembly = true
            else circuitSequencePosition += 1
        } else readyToAssembly = true

        // Assembly the ceremony.
        if (readyToAssembly) wannaAddAnotherCircuit = false
    }

    return circuitsInputData
}

/**
 * Check if the smallest pot has been already downloaded.
 * @param neededPowers <number> - the representation of the constraints of the circuit in terms of powers.
 * @returns <Promise<boolean>>
 */
const checkIfPotAlreadyDownloaded = async (neededPowers: number): Promise<boolean> => {
    // Get files from dir.
    const potFiles = await getDirFilesSubPaths(paths.potPath)

    let alreadyDownloaded = false

    for (const potFile of potFiles) {
        const powers = extractPoTFromFilename(potFile.name)

        if (powers === neededPowers) alreadyDownloaded = true
    }

    return alreadyDownloaded
}

/**
 * Setup a new Groth16 zkSNARK Phase 2 Trusted Setup ceremony.
 */
const setup = async () => {
    // Circuit data state.
    let circuitsInputData: Array<CircuitInputData> = []
    const circuits: Array<Circuit> = []

    /** CORE */
    try {
        // Get current working directory.
        const cwd = process.cwd()

        const { firebaseApp, firebaseFunctions } = await bootstrapCommandExec()

        // Handle current authenticated user sign in.
        const { user, username } = await handleCurrentAuthUserSignIn(firebaseApp)

        // Check custom claims for coordinator role.
        await onlyCoordinator(user)

        console.log(
            `${symbols.warning} To setup a zkSNARK Groth16 Phase 2 Trusted Setup ceremony you need to have the Rank-1 Constraint System (R1CS) file for each circuit in your working directory`
        )
        console.log(`${symbols.info} Current working directory: ${theme.bold(theme.underlined(cwd))}\n`)

        // Check if the current directory contains the .r1cs files.
        const cwdR1csFiles = await getSpecifiedFilesFromCwd(cwd, `.r1cs`)
        if (!cwdR1csFiles.length) showError(`Your working directory must contain the R1CS files for each circuit`, true)

        // Ask for ceremony input data.
        const ceremonyInputData = await askCeremonyInputData()
        const ceremonyPrefix = extractPrefix(ceremonyInputData.title)

        // Check for circom compiler version and commit hash.
        const { confirmation: isCircomVersionEqualAmongCircuits } = await askForConfirmation(
            "Was the same version of the circom compiler used for each circuit that will be designated for the ceremony?",
            "Yes",
            "No"
        )

        // Check for output directory.
        if (!directoryExists(paths.outputPath)) cleanDir(paths.outputPath)

        // Clean directories.
        cleanDir(paths.setupPath)
        cleanDir(paths.potPath)
        cleanDir(paths.metadataPath)
        cleanDir(paths.zkeysPath)

        if (isCircomVersionEqualAmongCircuits) {
            // Ask for circom compiler data.
            const { version, commitHash } = await askCircomCompilerVersionAndCommitHash()

            // Ask to add circuits.
            circuitsInputData = await handleCircuitsAddition(
                cwd,
                cwdR1csFiles,
                ceremonyInputData.timeoutMechanismType,
                isCircomVersionEqualAmongCircuits
            )

            // Add the data to the circuit input data.
            circuitsInputData = circuitsInputData.map((circuitInputData: CircuitInputData) => ({
                ...circuitInputData,
                compiler: { version, commitHash }
            }))
        } else
            circuitsInputData = await handleCircuitsAddition(
                cwd,
                cwdR1csFiles,
                ceremonyInputData.timeoutMechanismType,
                isCircomVersionEqualAmongCircuits
            )

        await simpleLoader(`Assembling your ceremony...`, `clock`, 2000)

        // Ceremony summary.
        let summary = `${`${theme.bold(ceremonyInputData.title)}\n${theme.italic(ceremonyInputData.description)}`}
    \n${`Opening: ${theme.bold(
        theme.underlined(ceremonyInputData.startDate.toUTCString().replace("GMT", "UTC"))
    )}\nEnding: ${theme.bold(theme.underlined(ceremonyInputData.endDate.toUTCString().replace("GMT", "UTC")))}`}
    \n${theme.bold(
        ceremonyInputData.timeoutMechanismType === CeremonyTimeoutType.DYNAMIC ? `Dynamic` : `Fixed`
    )} Timeout / ${theme.bold(ceremonyInputData.penalty)}m Penalty`

        for (let i = 0; i < circuitsInputData.length; i += 1) {
            const circuitInputData = circuitsInputData[i]

            // Read file.
            const r1csMetadataFilePath = `${paths.metadataPath}/${circuitInputData.prefix}_metadata.log`
            const circuitMetadata = readFile(r1csMetadataFilePath)

            // Extract info from file.
            const curve = getCircuitMetadataFromR1csFile(circuitMetadata, /Curve: .+\n/s)
            const wires = Number(getCircuitMetadataFromR1csFile(circuitMetadata, /# of Wires: .+\n/s))
            const constraints = Number(getCircuitMetadataFromR1csFile(circuitMetadata, /# of Constraints: .+\n/s))
            const privateInputs = Number(getCircuitMetadataFromR1csFile(circuitMetadata, /# of Private Inputs: .+\n/s))
            const publicOutputs = Number(getCircuitMetadataFromR1csFile(circuitMetadata, /# of Public Inputs: .+\n/s))
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
                    publicOutputs,
                    labels,
                    outputs,
                    pot
                }
            })

            // Show circuit summary.
            summary += `\n\n${theme.bold(
                `- CIRCUIT # ${theme.bold(theme.magenta(`${circuitInputData.sequencePosition}`))}`
            )}
      \n${`${theme.bold(circuitInputData.name)}\n${theme.italic(circuitInputData.description)}
      \nCurve: ${theme.bold(curve)}\nCompiler: v${theme.bold(`${circuitInputData.compiler.version}`)} (${theme.bold(
          circuitInputData.compiler.commitHash?.slice(0, 7)
      )})\nSource: ${theme.bold(circuitInputData.template.source.split(`/`).at(-1))}(${theme.bold(
          circuitInputData.template.paramsConfiguration
      )})\n${
          ceremonyInputData.timeoutMechanismType === CeremonyTimeoutType.DYNAMIC
              ? `Threshold: ${theme.bold(circuitInputData.timeoutThreshold)}%`
              : `Max Contribution Time: ${theme.bold(circuitInputData.timeoutMaxContributionWaitingTime)}m`
      }
      \n# Wires: ${theme.bold(wires)}\n# Constraints: ${theme.bold(constraints)}\n# Private Inputs: ${theme.bold(
          privateInputs
      )}\n# Public Inputs: ${theme.bold(publicOutputs)}\n# Labels: ${theme.bold(labels)}\n# Outputs: ${theme.bold(
          outputs
      )}\n# PoT: ${theme.bold(pot)}`}`
        }

        // Show ceremony summary.
        console.log(
            boxen(summary, {
                title: theme.magenta(`CEREMONY SUMMARY`),
                titleAlignment: "center",
                textAlignment: "left",
                margin: 1,
                padding: 1
            })
        )

        // Ask for confirmation.
        const { confirmation } = await askForConfirmation("Please, confirm to create the ceremony", "Okay", "Exit")

        if (confirmation) {
            // check that configuration is correct
            if (!process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || !process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS)
                showError(GENERIC_ERRORS.GENERIC_NOT_CONFIGURED_PROPERLY, true)

            // Create the bucket.
            if (!process.env.CONFIG_CEREMONY_BUCKET_POSTFIX)
                showError(GENERIC_ERRORS.GENERIC_NOT_CONFIGURED_PROPERLY, true)
            const bucketName = getBucketName(ceremonyPrefix, process.env.CONFIG_CEREMONY_BUCKET_POSTFIX!)
            if (!bucketName) showError(GENERIC_ERRORS.GENERIC_NOT_CONFIGURED_PROPERLY, true)

            const spinner = customSpinner(`Creating the storage bucket...`, `clock`)
            spinner.start()

            // @todo should handle return value
            await createS3Bucket(firebaseFunctions, bucketName)
            await sleep(1000)

            spinner.succeed(`Storage bucket ${bucketName} successfully created`)

            // Get local zkeys (if any).
            spinner.text = "Checking for pre-computed zkeys..."
            spinner.start()

            const cwdZkeysFiles = await getSpecifiedFilesFromCwd(cwd, `.zkey`)

            await sleep(1000)

            spinner.stop()

            let leftPreComputedZkeys: Array<Dirent> = cwdZkeysFiles

            // Circuit setup.
            for (let i = 0; i < circuits.length; i += 1) {
                // Flag for generation of zkey from scratch.
                let wannaGenerateZkey = true
                // Flag for PoT download.
                let wannaUsePreDownloadedPoT = false

                // Get the current circuit
                const circuit = circuits[i]

                // Convert to double digits powers (e.g., 9 -> 09).
                let stringifyNeededPowers = convertToDoubleDigits(circuit.metadata.pot)
                let smallestPotForCircuit = `${potFilenameTemplate}${stringifyNeededPowers}.ptau`

                // Circuit r1cs and zkey file names.
                const r1csFileName = `${circuit.name}.r1cs`
                const firstZkeyFileName = `${circuit.prefix}_00000.zkey`
                let preComputedZkeyNameWithExt = ``

                const r1csLocalPathAndFileName = `${cwd}/${r1csFileName}`
                let potLocalPathAndFileName = `${paths.potPath}/${smallestPotForCircuit}`
                let zkeyLocalPathAndFileName = `${paths.zkeysPath}/${firstZkeyFileName}`

                const potStoragePath = `${names.pot}`
                const r1csStoragePath = `${collections.circuits}/${circuit.prefix}`
                const zkeyStoragePath = `${collections.circuits}/${circuit.prefix}/${collections.contributions}`

                const r1csStorageFilePath = `${r1csStoragePath}/${r1csFileName}`
                let potStorageFilePath = `${potStoragePath}/${smallestPotForCircuit}`
                const zkeyStorageFilePath = `${zkeyStoragePath}/${firstZkeyFileName}`

                console.log(theme.bold(`\n- Setup for Circuit # ${theme.magenta(`${circuit.sequencePosition}`)}\n`))

                if (!leftPreComputedZkeys.length) console.log(`${symbols.warning} There are no pre-computed zKeys`)
                else {
                    const { confirmation: preComputedZkeySelection } = await askForConfirmation(
                        `Do you wanna select a pre-computed zkey for the ${circuit.name} circuit?`,
                        `Yes`,
                        `No`
                    )

                    if (preComputedZkeySelection) {
                        // Ask for zKey selection.
                        preComputedZkeyNameWithExt = await askForZkeySelectionFromLocalDir(leftPreComputedZkeys)

                        // Switch to pre-computed zkey path.
                        zkeyLocalPathAndFileName = `${cwd}/${preComputedZkeyNameWithExt}`

                        // Switch the flag.
                        wannaGenerateZkey = false
                    }
                }

                // If the coordinator wants to use a pre-computed zkey, needs to provide the related ptau.
                if (!wannaGenerateZkey) {
                    spinner.text = "Checking for Powers of Tau..."
                    spinner.start()

                    const cwdPtausFiles = await getSpecifiedFilesFromCwd(cwd, `.ptau`)
                    await sleep(1000)

                    if (!cwdPtausFiles.length) {
                        spinner.warn(`No Powers of Tau (.ptau) files found`)

                        // Download the PoT.
                        const { powers } = await askPowersOftau(circuit.metadata.pot)

                        // Convert to double digits powers (e.g., 9 -> 09).
                        stringifyNeededPowers = convertToDoubleDigits(Number(powers))
                        smallestPotForCircuit = `${potFilenameTemplate}${stringifyNeededPowers}.ptau`

                        // Override.
                        potLocalPathAndFileName = `${paths.potPath}/${smallestPotForCircuit}`
                        potStorageFilePath = `${potStoragePath}/${smallestPotForCircuit}`
                    } else {
                        spinner.stop()

                        // Ask for ptau selection.
                        smallestPotForCircuit = await askForPtauSelectionFromLocalDir(
                            cwdPtausFiles,
                            circuit.metadata.pot
                        )

                        // Update.
                        stringifyNeededPowers = convertToDoubleDigits(extractPoTFromFilename(smallestPotForCircuit))

                        // Switch to new ptau path.
                        potLocalPathAndFileName = `${cwd}/${smallestPotForCircuit}`
                        potStorageFilePath = `${potStoragePath}/${smallestPotForCircuit}`

                        wannaUsePreDownloadedPoT = true
                    }
                }

                // Check if the smallest pot has been already downloaded.
                const alreadyDownloaded =
                    (await checkIfPotAlreadyDownloaded(Number(smallestPotForCircuit))) || wannaUsePreDownloadedPoT

                if (!alreadyDownloaded) {
                    // Get smallest suitable pot for circuit.
                    const downloadSpinner = customSpinner(
                        `Downloading ${theme.bold(`#${stringifyNeededPowers}`)} Powers of Tau from PPoT...`,
                        "clock"
                    )
                    downloadSpinner.start()

                    // Download PoT file.
                    const potDownloadUrl = `${potDownloadUrlTemplate}${smallestPotForCircuit}`
                    const destFilePath = `${paths.potPath}/${smallestPotForCircuit}`

                    await downloadFileFromUrl(destFilePath, potDownloadUrl)

                    downloadSpinner.succeed(
                        `Powers of Tau ${theme.bold(`#${stringifyNeededPowers}`)} correctly downloaded`
                    )
                } else
                    console.log(
                        `${symbols.success} Powers of Tau ${theme.bold(`#${stringifyNeededPowers}`)} already downloaded`
                    )

                // Check if the smallest pot has been already uploaded.
                const alreadyUploadedPot = await objectExist(
                    firebaseFunctions,
                    bucketName,
                    `${ceremonyPrefix}/${names.pot}/${smallestPotForCircuit}`
                )

                // Validity check for the pre-computed zKey (avoids to upload an invalid combination of r1cs, ptau and zkey files).
                if (!wannaGenerateZkey) {
                    // Check validity.
                    await simpleLoader(`Checking pre-computed zkey validity...`, `clock`, 1500)

                    const valid = await zKey.verifyFromR1cs(
                        r1csLocalPathAndFileName,
                        potLocalPathAndFileName,
                        zkeyLocalPathAndFileName,
                        console
                    )

                    // nb. workaround for file descriptor closing.
                    await sleep(3000)

                    if (valid) {
                        spinner.succeed(`Your pre-computed zKey is valid`)

                        // Remove the selected zkey from the list.
                        leftPreComputedZkeys = leftPreComputedZkeys.filter(
                            (dirent: Dirent) => dirent.name !== preComputedZkeyNameWithExt
                        )

                        // Rename to first zkey filename.
                        renameSync(`${cwd}/${preComputedZkeyNameWithExt}`, `${circuit.prefix}_00000.zkey`)
                    } else {
                        spinner.fail(`Something went wrong during the verification of your pre-computed zKey`)

                        // Ask to generate a new one from scratch.
                        const { confirmation: zkeyGeneration } = await askForConfirmation(
                            `Do you wanna generate a new zkey for the ${circuit.name} circuit? (nb. A negative answer will ABORT the entire setup process)`,
                            `Yes`,
                            `No`
                        )

                        if (!zkeyGeneration) showError(`You have choosen to abort the entire setup process`, true)
                        else wannaGenerateZkey = true
                    }
                }

                // Generate a brand new zKey.
                if (wannaGenerateZkey) {
                    console.log(
                        `${symbols.warning} ${theme.bold(
                            `The computation of your zKey is starting soon (nb. do not interrupt the process because this will ABORT the entire setup process)`
                        )}\n`
                    )

                    // Compute first .zkey file (without any contribution).
                    await zKey.newZKey(
                        r1csLocalPathAndFileName,
                        potLocalPathAndFileName,
                        zkeyLocalPathAndFileName,
                        console
                    )

                    console.log(
                        `\n${symbols.success} First zkey ${theme.bold(firstZkeyFileName)} successfully computed`
                    )
                }

                spinner.text = `Uploading first zkey to storage...`
                spinner.start()

                // Upload zkey.
                await multiPartUpload(
                    firebaseFunctions,
                    bucketName,
                    zkeyStorageFilePath,
                    zkeyLocalPathAndFileName,
                    process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "50",
                    process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS || 7200
                )

                spinner.succeed(`First zkey ${theme.bold(firstZkeyFileName)} successfully saved on storage`)

                // PoT.
                if (!alreadyUploadedPot) {
                    spinner.text = `Uploading Powers of Tau file to storage...`
                    spinner.start()

                    // Upload.
                    await multiPartUpload(
                        firebaseFunctions,
                        bucketName,
                        potStorageFilePath,
                        potLocalPathAndFileName,
                        process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "50",
                        process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS || 7200
                    )

                    spinner.succeed(`Powers of Tau ${theme.bold(smallestPotForCircuit)} successfully saved on storage`)
                } else {
                    console.log(`${symbols.success} Powers of Tau ${theme.bold(smallestPotForCircuit)} already stored`)
                }

                spinner.text = `Uploading R1CS file to storage...`
                spinner.start()

                // Upload R1CS.
                await multiPartUpload(
                    firebaseFunctions,
                    bucketName,
                    r1csStorageFilePath,
                    r1csLocalPathAndFileName,
                    process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "50",
                    process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS || 7200
                )

                spinner.succeed(`R1CS ${theme.bold(r1csFileName)} successfully saved on storage`)

                // Circuit-related files info.
                const circuitFiles: CircuitFiles = {
                    files: {
                        r1csFilename: r1csFileName,
                        potFilename: smallestPotForCircuit,
                        initialZkeyFilename: firstZkeyFileName,
                        r1csStoragePath: r1csStorageFilePath,
                        potStoragePath: potStorageFilePath,
                        initialZkeyStoragePath: zkeyStorageFilePath,
                        r1csBlake2bHash: blake.blake2bHex(r1csStorageFilePath),
                        potBlake2bHash: blake.blake2bHex(potStorageFilePath),
                        initialZkeyBlake2bHash: blake.blake2bHex(zkeyStorageFilePath)
                    }
                }

                // nb. these will be validated after the first contribution.
                const circuitTimings: CircuitTimings = {
                    avgTimings: {
                        contributionComputation: 0,
                        fullContribution: 0,
                        verifyCloudFunction: 0
                    }
                }

                circuits[i] = {
                    ...circuit,
                    ...circuitFiles,
                    ...circuitTimings,
                    zKeySizeInBytes: getFileStats(zkeyLocalPathAndFileName).size
                }

                // Reset flags.
                wannaGenerateZkey = true
                wannaUsePreDownloadedPoT = false
            }

            process.stdout.write(`\n`)

            /** POPULATE DB */
            spinner.text = `Storing ceremony data...`
            spinner.start()

            // Setup ceremony on the server.
            await setupCeremony(firebaseFunctions, ceremonyInputData, ceremonyPrefix, circuits)

            // nb. workaround for CF termination.
            await sleep(1000)

            spinner.succeed(
                `Congrats, you have successfully completed your ${theme.bold(ceremonyInputData.title)} ceremony setup ${
                    emojis.tada
                }`
            )
        }

        terminate(username)
    } catch (err: any) {
        showError(`Something went wrong: ${err.toString()}`, true)
    }
}

export default setup
