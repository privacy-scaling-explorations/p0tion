#!/usr/bin/env node

import clear from "clear"
import figlet from "figlet"
import { zKey, r1cs } from "snarkjs"
import winston from "winston"
import blake from "blakejs"
import boxen from "boxen"
import { httpsCallable } from "firebase/functions"
import { Dirent } from "fs"
import { theme, symbols, emojis, ptauFilenameTemplate, ptauDownloadUrlTemplate, paths } from "../lib/constants.js"
import { checkForStoredOAuthToken, getCurrentAuthUser, onlyCoordinator, signIn } from "../lib/auth.js"
import { checkIfStorageFileExists, initServices, uploadFileToStorage } from "../lib/firebase.js"
import {
  customSpinner,
  estimatePoT,
  extractPoTFromFilename,
  extractPrefix,
  getCircuitMetadataFromR1csFile,
  getGithubUsername
} from "../lib/utils.js"
import {
  askCeremonyInputData,
  askCircuitInputData,
  askForCircuitSelectionFromLocalDir,
  askForConfirmation
} from "../lib/prompts.js"
import { cleanDir, directoryExists, downloadFileFromUrl, getDirFilesSubPaths, readFile } from "../lib/files.js"
import { Circuit, CircuitFiles, CircuitInputData, CircuitTimings } from "../../types/index.js"

/**
 * Ask user to add one or more circuits per ceremony.
 * @param r1csDirPath <string> - path to r1cs file directory.
 * @param metadataDirPath <string> - path to metadata file directory.
 * @returns <Promise<Array<CircuitInputData>>>
 */
const handleCircuitsAddition = async (ghUsername: string): Promise<Array<CircuitInputData>> => {
  const circuitsInputData: Array<CircuitInputData> = []

  let wannaAddAnotherCircuit = true
  let circuitSequencePosition = 1

  // Get r1cs files.
  const r1csFiles = await getDirFilesSubPaths(process.cwd())

  // Extract circuit names from filename.
  let leftCircuitNames = r1csFiles.map((file: Dirent) => file.name.substring(0, file.name.indexOf(".")))

  // Clear directory.
  cleanDir(paths.metadataPath)

  while (wannaAddAnotherCircuit) {
    console.log(theme.bold(`\nCircuit # ${theme.yellow(`${circuitSequencePosition}`)}\n`))

    // Interactively select a circuit.
    const circuitName = await askForCircuitSelectionFromLocalDir(leftCircuitNames)

    // Remove the selected circuit from the list.
    leftCircuitNames = leftCircuitNames.filter((name: string) => name !== circuitName)

    // Ask for circuit input data.
    const circuitInputData = await askCircuitInputData()
    const circuitPrefix = extractPrefix(circuitName)

    // R1CS circuit file path.
    const r1csMetadataFilePath = `${paths.metadataPath}/${circuitPrefix}_metadata.log`
    const r1csFilePath = `${process.cwd()}/${circuitPrefix}.r1cs`

    // Custom logger.
    const logger = winston.createLogger({
      level: "info",
      transports: new winston.transports.File({
        filename: r1csMetadataFilePath,
        format: winston.format.printf((log) => log.message),
        level: "info"
      })
    })

    const spinner = customSpinner(`Loading circuit data...`, "clock")
    spinner.start()

    // Read .r1cs file and log/store info.
    await r1cs.info(r1csFilePath, logger)

    spinner.stop()

    // Store data.
    circuitsInputData.push({
      ...circuitInputData,
      name: circuitName,
      prefix: circuitPrefix,
      sequencePosition: circuitSequencePosition
    })

    console.log(`${symbols.success} Circuit okay!`)

    process.stdout.write("\n")

    // Some circuits are still left.
    if (leftCircuitNames.length !== 0) {
      // Ask for another circuit.
      const { confirmation } = await askForConfirmation("Want to add another circuit for the ceremony?", "Yes", "No")

      if (confirmation === undefined) {
        console.log(`\nFarewell, @${theme.bold(ghUsername)}`)
        process.exit(0)
      }

      if (confirmation === false) wannaAddAnotherCircuit = false
      else circuitSequencePosition += 1
    }

    // In case of negative confirmation or no more circuits left.
    if (!wannaAddAnotherCircuit && leftCircuitNames.length !== 0) {
      process.stdout.write(`\n`)
      // Ask for another circuit.
      const { confirmation } = await askForConfirmation(
        `You have added ${circuitSequencePosition} of ${r1csFiles.length} circuits ${emojis.tada}. Are you sure you don't want to add more circuits and continue with the setup process?`,
        "Yes",
        "No"
      )

      if (confirmation === undefined) {
        console.log(`\nFarewell, @${theme.bold(ghUsername)}`)
        process.exit(0)
      }

      if (confirmation === false) wannaAddAnotherCircuit = true
      circuitSequencePosition += 1
    }

    // In case of negative confirmation or no more circuits left.
    if (leftCircuitNames.length === 0) {
      // Ask for another circuit.
      const { confirmation } = await askForConfirmation(
        `You have added ${circuitSequencePosition} of ${r1csFiles.length} circuits ${emojis.tada}. Please, confirm to continue with the setup process`,
        "Confirm",
        "Exit"
      )

      if (!confirmation) {
        console.log(`\nFarewell, @${theme.bold(ghUsername)}`)
        process.exit(0)
      } else wannaAddAnotherCircuit = false
    }
  }

  return circuitsInputData
}

/**
 * Check if the smallest ptau has been already downloaded.
 * @param ptauDirPath <string> - the dir path where the ptau files are contained.
 * @param neededPowers <number> - the representation of the constraints of the circuit in terms of powers.
 * @returns <Promise<boolean>>
 */
const checkIfPtauAlreadyDownloaded = async (ptauDirPath: string, neededPowers: number): Promise<boolean> => {
  // Get files from dir.
  const potFiles = await getDirFilesSubPaths(ptauDirPath)

  let alreadyDownloaded = false

  for (const potFile of potFiles) {
    const powers = extractPoTFromFilename(potFile.name)

    if (powers === neededPowers) alreadyDownloaded = true
  }

  return alreadyDownloaded
}

/**
 * Download a specified ptau file.
 * @param ptauDirPath <string> - the dir path where the ptau files are contained.
 * @param ptauFilename <string>
 * @returns <Promise<string>>
 */
const downloadPtau = async (ptauDirPath: string, ptauFilename: string): Promise<void> => {
  // Prepare for download.
  const ptauDownloadUrl = `${ptauDownloadUrlTemplate}${ptauFilename}`
  const destFilePath = `${ptauDirPath}/${ptauFilename}`

  await downloadFileFromUrl(destFilePath, ptauDownloadUrl)
}

/**
 * Setup a new Groth16 zkSNARK Phase 2 Trusted Setup ceremony.
 */
async function setup() {
  clear()

  // Custom spinner.
  let spinner

  // Circuit data state.
  let circuitsInputData: Array<CircuitInputData> = []
  const circuits: Array<Circuit> = []

  console.log(theme.yellow(figlet.textSync("MPC Phase2 Suite", { font: "ANSI Shadow", horizontalLayout: "full" })))

  /** CORE */
  try {
    // Initialize services.
    const { firebaseFunctions } = await initServices()
    const setupCeremony = httpsCallable(firebaseFunctions, "setupCeremony")

    // Get/Set OAuth Token.
    const ghToken = await checkForStoredOAuthToken()

    // Sign in.
    await signIn(ghToken)

    // Get current authenticated user.
    const user = getCurrentAuthUser()

    // Get user Github username.
    const ghUsername = await getGithubUsername(ghToken)

    console.log(`Greetings! ${emojis.wave} You are connected as @${theme.bold(ghUsername)}\n`)

    // Check custom claims for coordinator role.
    await onlyCoordinator(user)

    // TODO: inform the user.
    console.log(
      `You are about to perform the setup for a zkSNARK Groth16 Phase2 Trusted Setup ceremony ${emojis.key}\nThe setup command requires only the Rank-1 Constraint System (R1CS) files produced by the compilation with circom.`
    )

    // Check if the current directory contains the .r1cs files.
    const r1csFiles = (await getDirFilesSubPaths(process.cwd())).filter((file: Dirent) => file.name.includes(".r1cs"))

    if (r1csFiles.length === 0)
      throw new Error(
        `Please, move to a folder containing the Rank-1 Constraint System files obtained from circom compilation output!`
      )

    // Check for output directory.
    if (!directoryExists(paths.outputPath)) cleanDir(paths.outputPath)

    // Clean directories.
    cleanDir(paths.setupPath)
    cleanDir(paths.potPath)
    cleanDir(paths.metadataPath)
    cleanDir(paths.zkeysPath)

    process.stdout.write(`\n`)
    // Ask for ceremony input data.
    const ceremonyInputData = await askCeremonyInputData()
    const ceremonyPrefix = extractPrefix(ceremonyInputData.title)

    // Ask to add circuits.
    circuitsInputData = await handleCircuitsAddition(ghUsername)

    // Ceremony summary.
    let summary = `${`${theme.bold(ceremonyInputData.title)}\n${theme.italic(ceremonyInputData.description)}`}
    \n${`Opens on ${theme.bold(
      theme.underlined(ceremonyInputData.startDate.toUTCString().replace("GMT", "UTC"))
    )}\nCloses on ${theme.bold(theme.underlined(ceremonyInputData.endDate.toUTCString().replace("GMT", "UTC")))}`}`

    for (let i = 0; i < circuitsInputData.length; i += 1) {
      const circuitInputData = circuitsInputData[i]

      // Read file.
      const r1csMetadataFilePath = `${paths.metadataPath}/${circuitInputData.prefix}_metadata.log`
      const circuitMetadata = readFile(r1csMetadataFilePath).toString()

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

      // Circuit summary.
      summary += `\n\n${theme.bold(`- CIRCUIT # ${theme.yellow(`${circuitInputData.sequencePosition}`)}`)}
      \n${`${theme.bold(circuitInputData.name)}\n${theme.italic(circuitInputData.description)}`}
      \n${`${`Curve: ${theme.bold(theme.yellow(curve))}`}`}
      \n${`# Wires: ${theme.bold(theme.yellow(wires))}\n# Constraints: ${theme.bold(
        theme.yellow(constraints)
      )}\n# Private Inputs: ${theme.bold(theme.yellow(privateInputs))}\n# Public Inputs: ${theme.bold(
        theme.yellow(publicOutputs)
      )}\n# Labels: ${theme.bold(theme.yellow(labels))}\n# Outputs: ${theme.bold(
        theme.yellow(outputs)
      )}\n# PoT: ${theme.bold(theme.yellow(pot))}`}`
    }

    // Show summary.
    console.log(
      boxen(summary, {
        title: theme.yellow(theme.bold(`CEREMONY SUMMARY`)),
        titleAlignment: "center",
        textAlignment: "left",
        margin: 1,
        padding: 1
      })
    )

    // Ask for confirmation.
    const { confirmation } = await askForConfirmation(
      "Do you confirm that you want to create a ceremony with the above information?",
      "Yes",
      "No"
    )

    if (confirmation) {
      for (let i = 0; i < circuits.length; i += 1) {
        const circuit = circuits[i]

        /** SETUP FOR EACH CIRCUIT */
        console.log(theme.bold(`\n- SETUP FOR CIRCUIT # ${theme.yellow(`${circuit.sequencePosition}`)}\n`))

        // Check if the smallest ptau has been already downloaded.
        const alreadyDownloaded = await checkIfPtauAlreadyDownloaded(paths.potPath, circuit.metadata.pot)

        const stringifyNeededPowers =
          circuit.metadata.pot >= 10 ? circuit.metadata.pot.toString() : `0${circuit.metadata.pot}`
        const smallestPtauForCircuit = `${ptauFilenameTemplate}${stringifyNeededPowers}.ptau`

        if (!alreadyDownloaded) {
          // Get smallest suitable ptau for circuit.
          spinner = customSpinner(`Downloading smallest PoT file...`, "clock")
          spinner.start()

          await downloadPtau(paths.potPath, smallestPtauForCircuit)

          spinner.stop()
          console.log(`${symbols.success} ptau download completed!\n`)
        } else console.log(`${symbols.success} already downloaded!\n`)

        // Check if the smallest ptau has been already uploaded.
        const alreadyUploadedPtau = await checkIfStorageFileExists(`${ceremonyPrefix}/ptau/${smallestPtauForCircuit}`)

        // Circuit r1cs and zkey file names.
        const r1csFileName = `${circuit.prefix}.r1cs`
        const firstZkeyFileName = `${circuit.prefix}_00000.zkey`

        const r1csLocalPathAndFileName = `${process.cwd()}/${r1csFileName}`
        const ptauLocalPathAndFileName = `${paths.potPath}/${smallestPtauForCircuit}`
        const zkeyLocalPathAndFileName = `${paths.zkeysPath}/${firstZkeyFileName}`

        const ptauStoragePath = `${ceremonyPrefix}/ptau`
        const r1csStoragePath = `${ceremonyPrefix}/circuits/${circuit.prefix}`
        const zkeyStoragePath = `${ceremonyPrefix}/circuits/${circuit.prefix}/contributions`

        const r1csStorageFilePath = `${r1csStoragePath}/${r1csFileName}`
        const potStorageFilePath = `${ptauStoragePath}/${smallestPtauForCircuit}`
        const zkeyStorageFilePath = `${zkeyStoragePath}/${firstZkeyFileName}`

        // Compute first .zkey file (without any contribution).
        await zKey.newZKey(r1csLocalPathAndFileName, ptauLocalPathAndFileName, zkeyLocalPathAndFileName, console)

        process.stdout.write("\n")
        console.log(`${symbols.success} ${firstZkeyFileName} generated`)

        // PTAU.
        if (!alreadyUploadedPtau) {
          spinner = customSpinner(`Uploading .ptau file...`, "clock")
          spinner.start()

          // Upload.
          await uploadFileToStorage(ptauLocalPathAndFileName, potStorageFilePath)

          spinner.stop()

          console.log(`${symbols.success} ${smallestPtauForCircuit} stored`)
        } else {
          console.log(`${symbols.success} ${smallestPtauForCircuit} already stored`)
        }

        // R1CS.
        spinner = customSpinner(`Uploading .r1cs file...`, "clock")
        spinner.start()

        // Upload.
        await uploadFileToStorage(r1csLocalPathAndFileName, r1csStorageFilePath)

        spinner.stop()

        console.log(`${symbols.success} ${r1csFileName} stored`)

        // ZKEY.
        spinner = customSpinner(`Uploading .zkey file...`, "clock")
        spinner.start()

        // Upload.
        await uploadFileToStorage(zkeyLocalPathAndFileName, zkeyStorageFilePath)

        spinner.stop()

        console.log(`${symbols.success} ${firstZkeyFileName} stored`)

        // Circuit-related files info.
        const circuitFiles: CircuitFiles = {
          files: {
            r1csFilename: r1csFileName,
            ptauFilename: smallestPtauForCircuit,
            initialZkeyFilename: firstZkeyFileName,
            r1csStoragePath: r1csStorageFilePath,
            ptauStoragePath: potStorageFilePath,
            initialZkeyStoragePath: zkeyStorageFilePath,
            r1csBlake2bHash: blake.blake2bHex(r1csStorageFilePath),
            ptauBlake2bHash: blake.blake2bHex(potStorageFilePath),
            initialZkeyBlake2bHash: blake.blake2bHex(zkeyStorageFilePath)
          }
        }

        const circuitTimings: CircuitTimings = {
          avgTimings: {
            avgContributionTime: 0,
            avgVerificationTime: 0
          }
        }

        circuits[i] = {
          ...circuit,
          ...circuitFiles,
          ...circuitTimings
        }
      }

      /** POPULATE DB */
      spinner = customSpinner(`Storing data on database...`, "clock")

      // Setup ceremony on the server.
      await setupCeremony({
        ceremonyInputData,
        ceremonyPrefix,
        circuits
      })

      spinner.stop()

      console.log(
        `\nYou have successfully completed your ${theme.bold(
          ceremonyInputData.title
        )} ceremony setup! Congratulations, @${theme.bold(ghUsername)} ${emojis.tada}`
      )
    } else console.log(`\nFarewell, @${theme.bold(ghUsername)}`)

    process.exit(0)
  } catch (err: any) {
    if (err) {
      const error = err.toString()
      console.error(`\n${symbols.error} Oops, something went wrong: \n${error}`)

      process.exit(1)
    }
  }
}

export default setup
