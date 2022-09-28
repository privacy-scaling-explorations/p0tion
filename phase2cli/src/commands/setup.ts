#!/usr/bin/env node

import { zKey, r1cs } from "snarkjs"
import winston from "winston"
import blake from "blakejs"
import boxen from "boxen"
import { httpsCallable } from "firebase/functions"
import { Dirent } from "fs"
import {
  theme,
  symbols,
  emojis,
  potFilenameTemplate,
  potDownloadUrlTemplate,
  paths,
  names,
  collections
} from "../lib/constants.js"
import { handleAuthUserSignIn, onlyCoordinator } from "../lib/auth.js"
import {
  bootstrapCommandExec,
  convertToDoubleDigits,
  customSpinner,
  estimatePoT,
  extractPoTFromFilename,
  extractPrefix,
  getBucketName,
  getCircuitMetadataFromR1csFile,
  multiPartUpload,
  sleep,
  terminate
} from "../lib/utils.js"
import {
  askCeremonyInputData,
  askCircuitInputData,
  askForCircuitSelectionFromLocalDir,
  askForConfirmation
} from "../lib/prompts.js"
import {
  cleanDir,
  directoryExists,
  downloadFileFromUrl,
  getDirFilesSubPaths,
  getFileStats,
  readFile
} from "../lib/files.js"
import { Circuit, CircuitFiles, CircuitInputData, CircuitTimings } from "../../types/index.js"
import { GENERIC_ERRORS, showError } from "../lib/errors.js"
import { createS3Bucket, objectExist } from "../lib/storage.js"

/**
 * Return the R1CS files from the current working directory.
 * @param cwd <string> - the current working directory.
 * @returns <Promise<Array<Dirent>>>
 */
const getR1CSFilesFromCwd = async (cwd: string): Promise<Array<Dirent>> => {
  // Check if the current directory contains the .r1cs files.
  const cwdFiles = await getDirFilesSubPaths(cwd)
  const cwdR1csFiles = cwdFiles.filter((file: Dirent) => file.name.includes(".r1cs"))

  if (!cwdR1csFiles.length)
    showError(`Your working directory must contain the Rank-1 Constraint System (R1CS) file for each circuit`, true)

  return cwdR1csFiles
}

/**
 * Handle one or more circuit addition for the specified ceremony.
 * @param cwd <string> - the current working directory.
 * @param cwdR1csFiles <Array<Dirent>> - the list of R1CS files in the current working directory.
 * @returns <Promise<Array<CircuitInputData>>>
 */
const handleCircuitsAddition = async (cwd: string, cwdR1csFiles: Array<Dirent>): Promise<Array<CircuitInputData>> => {
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
    const circuitInputData = await askCircuitInputData()
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

    const spinner = customSpinner(`Looking for metadata...`, "clock")
    spinner.start()

    // Read .r1cs file and log/store info.
    await r1cs.info(r1csFilePath, logger)
    // Sleep to avoid logger unexpected termination.
    await sleep(2000)

    spinner.stop()

    // Store data.
    circuitsInputData.push({
      ...circuitInputData,
      name: circuitName,
      prefix: circuitPrefix,
      sequencePosition: circuitSequencePosition
    })

    console.log(
      `${symbols.success} Metadata stored in your working directory ${theme.bold(
        theme.underlined(r1csMetadataFilePath.substring(1))
      )}\n`
    )

    let readyToAssembly = false

    // In case of negative confirmation or no more circuits left.
    if (leftCircuits.length !== 0) {
      // Ask for another circuit.
      const { confirmation } = await askForConfirmation("Want to add another circuit for the ceremony?", "Okay", "No")

      if (confirmation === undefined) showError(GENERIC_ERRORS.GENERIC_DATA_INPUT, true)

      if (confirmation === false) readyToAssembly = true
      else circuitSequencePosition += 1
    } else readyToAssembly = true

    // Assembly the ceremony.
    if (readyToAssembly) {
      const spinner = customSpinner(`Assembling your ceremony...`, "clock")
      spinner.start()

      await sleep(2000)

      spinner.stop()

      wannaAddAnotherCircuit = false
    }
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
  // Custom spinner.
  let spinner

  // Circuit data state.
  let circuitsInputData: Array<CircuitInputData> = []
  const circuits: Array<Circuit> = []

  /** CORE */
  try {
    // Get current working directory.
    const cwd = process.cwd()

    const { firebaseFunctions } = await bootstrapCommandExec()

    // Setup ceremony callable Cloud Function initialization.
    const setupCeremony = httpsCallable(firebaseFunctions, "setupCeremony")
    const createBucket = httpsCallable(firebaseFunctions, "createBucket")
    const startMultiPartUpload = httpsCallable(firebaseFunctions, "startMultiPartUpload")
    const generatePreSignedUrlsParts = httpsCallable(firebaseFunctions, "generatePreSignedUrlsParts")
    const completeMultiPartUpload = httpsCallable(firebaseFunctions, "completeMultiPartUpload")
    const checkIfObjectExist = httpsCallable(firebaseFunctions, "checkIfObjectExist")

    // Handle authenticated user sign in.
    const { user, ghUsername } = await handleAuthUserSignIn()

    // Check custom claims for coordinator role.
    await onlyCoordinator(user)

    console.log(
      `${symbols.warning} To setup a zkSNARK Groth16 Phase 2 Trusted Setup ceremony you need to have the Rank-1 Constraint System (R1CS) file for each circuit in your working directory`
    )
    console.log(`${symbols.info} Current working directory: ${theme.bold(theme.underlined(cwd))}\n`)

    // Check if the current directory contains the .r1cs files.
    const cwdR1csFiles = await getR1CSFilesFromCwd(cwd)

    // Ask for ceremony input data.
    const ceremonyInputData = await askCeremonyInputData()
    const ceremonyPrefix = extractPrefix(ceremonyInputData.title)

    // Check for output directory.
    if (!directoryExists(paths.outputPath)) cleanDir(paths.outputPath)

    // Clean directories.
    cleanDir(paths.setupPath)
    cleanDir(paths.potPath)
    cleanDir(paths.metadataPath)
    cleanDir(paths.zkeysPath)

    // Ask to add circuits.
    circuitsInputData = await handleCircuitsAddition(cwd, cwdR1csFiles)

    // Ceremony summary.
    let summary = `${`${theme.bold(ceremonyInputData.title)}\n${theme.italic(ceremonyInputData.description)}`}
    \n${`Opens on ${theme.bold(
      theme.underlined(ceremonyInputData.startDate.toUTCString().replace("GMT", "UTC"))
    )}\nCloses on ${theme.bold(theme.underlined(ceremonyInputData.endDate.toUTCString().replace("GMT", "UTC")))}`}`

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
      const pot = estimatePoT(constraints)

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
      summary += `\n\n${theme.bold(`- CIRCUIT # ${theme.bold(theme.magenta(`${circuitInputData.sequencePosition}`))}`)}
      \n${`${theme.bold(circuitInputData.name)}\n${theme.italic(circuitInputData.description)}
      \nCurve: ${theme.bold(curve)}
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

    // Create the bucket.
    const bucketName = getBucketName(ceremonyPrefix)

    spinner = customSpinner(`Creating the storage bucket...`, `clock`)
    spinner.start()

    await createS3Bucket(createBucket, bucketName)
    await sleep(3000)

    spinner.stop()

    if (confirmation) {
      // Circuit setup.
      for (let i = 0; i < circuits.length; i += 1) {
        // Get the current circuit
        const circuit = circuits[i]

        console.log(theme.bold(`\n- Setup for Circuit # ${theme.magenta(`${circuit.sequencePosition}`)}\n`))

        // Check if the smallest pot has been already downloaded.
        const alreadyDownloaded = await checkIfPotAlreadyDownloaded(circuit.metadata.pot)

        // Convert to double digits powers (e.g., 9 -> 09).
        const stringifyNeededPowers = convertToDoubleDigits(circuit.metadata.pot)
        const smallestPotForCircuit = `${potFilenameTemplate}${stringifyNeededPowers}.ptau`

        if (!alreadyDownloaded) {
          // Get smallest suitable pot for circuit.
          spinner = customSpinner(
            `Downloading ${theme.bold(`#${stringifyNeededPowers}`)} Powers of Tau from PPoT...`,
            "clock"
          )
          spinner.start()

          // Download PoT file.
          const potDownloadUrl = `${potDownloadUrlTemplate}${smallestPotForCircuit}`
          const destFilePath = `${paths.potPath}/${smallestPotForCircuit}`

          await downloadFileFromUrl(destFilePath, potDownloadUrl)

          spinner.stop()
          console.log(
            `${symbols.success} Powers of Tau ${theme.bold(`#${stringifyNeededPowers}`)} correctly downloaded`
          )
        } else
          console.log(`${symbols.success} Powers of Tau ${theme.bold(`#${stringifyNeededPowers}`)} already downloaded`)

        // Check if the smallest pot has been already uploaded.
        const alreadyUploadedPot = await objectExist(
          checkIfObjectExist,
          bucketName,
          `${ceremonyPrefix}/${names.pot}/${smallestPotForCircuit}`
        )

        // Circuit r1cs and zkey file names.
        const r1csFileName = `${circuit.name}.r1cs`
        const firstZkeyFileName = `${circuit.prefix}_00000.zkey`

        const r1csLocalPathAndFileName = `${cwd}/${r1csFileName}`
        const potLocalPathAndFileName = `${paths.potPath}/${smallestPotForCircuit}`
        const zkeyLocalPathAndFileName = `${paths.zkeysPath}/${firstZkeyFileName}`

        const potStoragePath = `${names.pot}`
        const r1csStoragePath = `${collections.circuits}/${circuit.prefix}`
        const zkeyStoragePath = `${collections.circuits}/${circuit.prefix}/${collections.contributions}`

        const r1csStorageFilePath = `${r1csStoragePath}/${r1csFileName}`
        const potStorageFilePath = `${potStoragePath}/${smallestPotForCircuit}`
        const zkeyStorageFilePath = `${zkeyStoragePath}/${firstZkeyFileName}`

        console.log(
          `${symbols.warning} ${theme.bold(
            `Computation of the first zkey will begin soon. Please do not interrupt the process or you will have to repeat everything from scratch!`
          )}\n`
        )

        // Compute first .zkey file (without any contribution).
        await zKey.newZKey(r1csLocalPathAndFileName, potLocalPathAndFileName, zkeyLocalPathAndFileName, console)

        console.log(`\n${symbols.success} First zkey ${theme.bold(firstZkeyFileName)} successfully computed`)

        // Upload zkey.
        await multiPartUpload(
          startMultiPartUpload,
          generatePreSignedUrlsParts,
          completeMultiPartUpload,
          bucketName,
          zkeyStorageFilePath,
          zkeyLocalPathAndFileName
        )

        console.log(`${symbols.success} First zkey ${theme.bold(firstZkeyFileName)} successfully saved on storage`)

        // PoT.
        if (!alreadyUploadedPot) {
          // Upload.
          await multiPartUpload(
            startMultiPartUpload,
            generatePreSignedUrlsParts,
            completeMultiPartUpload,
            bucketName,
            potStorageFilePath,
            potLocalPathAndFileName
          )

          console.log(
            `${symbols.success} Powers of Tau ${theme.bold(smallestPotForCircuit)} successfully saved on storage`
          )
        } else {
          console.log(`${symbols.success} Powers of Tau ${theme.bold(smallestPotForCircuit)} already stored`)
        }

        // Upload R1CS.
        await multiPartUpload(
          startMultiPartUpload,
          generatePreSignedUrlsParts,
          completeMultiPartUpload,
          bucketName,
          r1csStorageFilePath,
          r1csLocalPathAndFileName
        )

        console.log(`${symbols.success} R1CS ${theme.bold(r1csFileName)} successfully saved on storage`)

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
      }

      process.stdout.write(`\n`)

      /** POPULATE DB */
      spinner = customSpinner(`Storing ceremony data...`, "clock")
      spinner.start()

      // Setup ceremony on the server.
      await setupCeremony({
        ceremonyInputData,
        ceremonyPrefix,
        circuits
      })
      await sleep(2000)

      spinner.stop()

      console.log(
        `\nCongrats, you have successfully completed your ${theme.bold(ceremonyInputData.title)} ceremony setup ${
          emojis.tada
        }`
      )
    }

    terminate(ghUsername)
  } catch (err: any) {
    showError(`Something went wrong: ${err.toString()}`, true)
  }
}

export default setup
