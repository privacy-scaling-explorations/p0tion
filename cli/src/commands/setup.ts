#!/usr/bin/env node

import clear from "clear"
import figlet from "figlet"
import dotenv from "dotenv"
import { zKey, r1cs } from "snarkjs"
import winston from "winston"
import blake from "blakejs"
import boxen from "boxen"
import theme from "../lib/theme.js"
import { checkForStoredOAuthToken, getCurrentAuthUser, onlyCoordinator, signIn } from "../lib/auth.js"
import { checkIfStorageFileExists, initServices, setDocument, uploadFileToStorage } from "../lib/firebase.js"
import {
  convertSecondsToMillis,
  customSpinner,
  estimatePoT,
  extractPrefix,
  extractPtauPowers,
  getCircuitMetadataFromR1csFile,
  getGithubUsername,
  getServerTimestampInMillis
} from "../lib/utils.js"
import { askCeremonyInputData, askCircuitInputData, askForConfirmation } from "../lib/prompts.js"
import { checkIfDirectoryIsEmpty, cleanDir, getDirFilesSubPaths, readFile } from "../lib/files.js"
import { CeremonyState, CeremonyType, Circuit, CircuitInputData, LocalPathDirectories } from "../../types/index.js"

dotenv.config()

/**
 * Check if the LOCAL_PATH_ environment variables are set correctly in the .env file.
 * @returns <LocalPathDirectories>
 */
const checkLocalPathEnvVars = (): LocalPathDirectories => {
  if (
    !process.env.LOCAL_PATH_DIR_CIRCUITS_R1CS ||
    !process.env.LOCAL_PATH_DIR_PTAU ||
    !process.env.LOCAL_PATH_DIR_CIRCUITS_METADATA ||
    !process.env.LOCAL_PATH_DIR_ZKEYS
  )
    throw new Error("\nPlease, check that all LOCAL_PATH_ variables in the .env file are set correctly.")

  return {
    r1csDirPath: process.env.LOCAL_PATH_DIR_CIRCUITS_R1CS,
    metadataDirPath: process.env.LOCAL_PATH_DIR_CIRCUITS_METADATA,
    zkeysDirPath: process.env.LOCAL_PATH_DIR_ZKEYS,
    ptauDirPath: process.env.LOCAL_PATH_DIR_PTAU
  }
}

/**
 * Ask user to add one or more circuits per ceremony.
 * @param r1csDirPath <string> - path to r1cs file directory.
 * @param metadataDirPath <string> - path to metadata file directory.
 * @returns <Promise<Array<CircuitInputData>>>
 */
const handleCircuitsAddition = async (
  r1csDirPath: string,
  metadataDirPath: string
): Promise<Array<CircuitInputData>> => {
  const circuitsInputData: Array<CircuitInputData> = []

  let wannaAddAnotherCircuit = true
  let circuitSequencePosition = 1

  // Clear directory.
  cleanDir(metadataDirPath)

  while (wannaAddAnotherCircuit) {
    console.log(theme.monoD(theme.bold(`\nCircuit # ${theme.yellowD(`${circuitSequencePosition}`)}\n`)))

    // Ask for circuit input data.
    const circuitInputData = await askCircuitInputData()
    const circuitPrefix = extractPrefix(circuitInputData.name)

    // R1CS circuit file path.
    const r1csMetadataFilePath = `${metadataDirPath}/${circuitPrefix}_metadata.log`
    const r1csFilePath = `${r1csDirPath}/${circuitPrefix}.r1cs`

    // Custom logger.
    const logger = winston.createLogger({
      level: "info",
      transports: new winston.transports.File({
        filename: r1csMetadataFilePath,
        format: winston.format.printf((log) => log.message),
        level: "info"
      })
    })

    const spinner = customSpinner(`Looking for ${circuitPrefix}.r1cs in \`circuits\\r1cs\` folder... \n\n`, "clock")
    spinner.start()

    // Read .r1cs file and log/store info.
    await r1cs.info(r1csFilePath, logger)

    spinner.stop()

    // Store data.
    circuitsInputData.push({
      ...circuitInputData,
      prefix: circuitPrefix,
      sequencePosition: circuitSequencePosition
    })

    console.log(`${theme.success} Metadata from R1CS`)

    process.stdout.write("\n")

    // Ask for another circuit.
    const { confirmation } = await askForConfirmation("Want to add another circuit for the ceremony?", "Yes", "No")

    if (!confirmation) wannaAddAnotherCircuit = false
    else circuitSequencePosition += 1
  }

  return circuitsInputData
}

/**
 * Return the name of the smallest ptau file which fits the circuit constraints given as powers.
 * @param ptauDirPath <string> - the directory where the ptau files are stored.
 * @param powers <number> - the representation of the constraints of the circuit in terms of powers.
 * @returns <Promise<string>>
 */
const getSmallestPtau = async (ptauDirPath: string, neededPowers: number): Promise<string> => {
  // Get files from dir.
  const files = await getDirFilesSubPaths(ptauDirPath)

  // Supporting vars.
  let smallestPtauFilename = ""
  let smallestPowers = 0

  for (const file of files) {
    // Get .ptau number (powers) from filename.
    const ptauPowers = extractPtauPowers(file.name)

    // Check for the smallest ptau suitable for the needed powers.
    if ((!smallestPtauFilename && neededPowers <= ptauPowers) || smallestPowers >= ptauPowers) {
      smallestPowers = ptauPowers
      smallestPtauFilename = file.name
    }
  }

  if (!smallestPtauFilename || !smallestPowers)
    throw new Error(`Oops, seems there are no suitable .ptau files in the ${ptauDirPath}`)

  return smallestPtauFilename
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

  console.log(theme.yellowD(figlet.textSync("MPC Phase2 Suite", { font: "ANSI Shadow", horizontalLayout: "full" })))

  /** CORE */
  try {
    // Check for LOCAL_PATH_ env. vars.
    const { r1csDirPath, metadataDirPath, zkeysDirPath, ptauDirPath } = checkLocalPathEnvVars()

    // Initialize services.
    await initServices()

    // Get/Set OAuth Token.
    const ghToken = await checkForStoredOAuthToken()

    // Sign in.
    await signIn(ghToken)

    // Get current authenticated user.
    const user = getCurrentAuthUser()

    // Get user Github username.
    const ghUsername = await getGithubUsername(ghToken)

    console.log(theme.monoD(`Greetings! 👋 You are connected as @${theme.bold(ghUsername)}\n`))

    // Check custom claims for coordinator role.
    await onlyCoordinator(user)

    // Check if .ptau and .r1cs dirs are not empty.
    if (await checkIfDirectoryIsEmpty(r1csDirPath))
      throw new Error(`Please, place the .r1cs files in the ${r1csDirPath} directory.`)

    if (await checkIfDirectoryIsEmpty(ptauDirPath))
      throw new Error(`Please, place the .ptau files in the ${r1csDirPath} directory.`)

    // Ask for ceremony input data.
    const ceremonyInputData = await askCeremonyInputData()
    const ceremonyPrefix = extractPrefix(ceremonyInputData.title)

    // Ask to add circuits.
    circuitsInputData = await handleCircuitsAddition(r1csDirPath, metadataDirPath)

    // Ceremony summary.
    let summary = `${theme.monoD(
      `${theme.bold(ceremonyInputData.title)}\n${theme.italic(ceremonyInputData.description)}`
    )}
    \n${theme.monoD(
      `Opens on ${theme.bold(theme.underlined(ceremonyInputData.startDate.toUTCString()))}\nCloses on ${theme.bold(
        theme.underlined(ceremonyInputData.endDate.toUTCString())
      )}`
    )}`

    for (let i = 0; i < circuitsInputData.length; i += 1) {
      const circuitInputData = circuitsInputData[i]

      // Read file.
      const r1csMetadataFilePath = `${metadataDirPath}/${circuitInputData.prefix}_metadata.log`
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
      summary += `\n\n${theme.monoD(theme.bold(`- CIRCUIT # ${theme.yellowD(`${circuitInputData.sequencePosition}`)}`))}
      \n${theme.monoD(`${theme.bold(circuitInputData.name)}\n${theme.italic(circuitInputData.description)}`)}
      \n${theme.monoD(
        `Est. for contribution time ~ ${theme.bold(
          theme.yellowD(circuitInputData.avgContributionTime)
        )} secs.\n${theme.monoD(`Curve: ${theme.bold(theme.yellowD(curve))}`)}`
      )}
      \n${theme.monoD(
        `# Wires: ${theme.bold(theme.yellowD(wires))}\n# Constraints: ${theme.bold(
          theme.yellowD(constraints)
        )}\n# Private Inputs: ${theme.bold(theme.yellowD(privateInputs))}\n# Public Inputs: ${theme.bold(
          theme.yellowD(publicOutputs)
        )}\n# Labels: ${theme.bold(theme.yellowD(labels))}\n# Outputs: ${theme.bold(
          theme.yellowD(outputs)
        )}\n# PoT: ${theme.bold(theme.yellowD(pot))}`
      )}
      `
    }

    // Show summary.
    console.log(
      boxen(summary, {
        title: theme.yellowD(theme.bold(`CEREMONY SUMMARY`)),
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
      cleanDir("./zkeys/")

      for (let i = 0; i < circuits.length; i += 1) {
        const circuit = circuits[i]

        /** SETUP FOR EACH CIRCUIT */
        console.log(
          theme.monoD(theme.bold(`\n- SETUP FOR CIRCUIT # ${theme.yellowD(`${circuit.sequencePosition}`)}\n`))
        )

        // Get smallest suitable ptau for circuit.
        const smallestPtauForCircuit = await getSmallestPtau(ptauDirPath, circuit.metadata.pot)

        // Check if the smallest ptau has been already uploaded.
        const alreadyUploadedPtau = await checkIfStorageFileExists(`${ceremonyPrefix}/ptau/${smallestPtauForCircuit}`)

        // Circuit r1cs and zkey file names.
        const r1csFileName = `${circuit.prefix}.r1cs`
        const firstZkeyFileName = `${circuit.prefix}_00000.zkey`

        const r1csLocalPathAndFileName = `${r1csDirPath}/${r1csFileName}`
        const ptauLocalPathAndFileName = `${ptauDirPath}/${smallestPtauForCircuit}`
        const zkeyLocalPathAndFileName = `${zkeysDirPath}/${firstZkeyFileName}`

        // Compute first .zkey file (without any contribution).
        await zKey.newZKey(r1csLocalPathAndFileName, ptauLocalPathAndFileName, zkeyLocalPathAndFileName, console)

        process.stdout.write("\n")
        console.log(`${theme.success} ${firstZkeyFileName} generated`)

        // PTAU.
        if (!alreadyUploadedPtau) {
          spinner = customSpinner(`Uploading .ptau file...`, "clock")
          spinner.start()

          const ptauStoragePath = `${ceremonyPrefix}/ptau`

          // Upload.
          await uploadFileToStorage(ptauLocalPathAndFileName, `${ptauStoragePath}/${smallestPtauForCircuit}`)

          spinner.stop()

          console.log(`${theme.success} ${smallestPtauForCircuit} stored`)
        } else {
          console.log(`${theme.success} ${smallestPtauForCircuit} already stored`)
        }

        // R1CS.
        spinner = customSpinner(`Uploading .r1cs file...`, "clock")
        spinner.start()

        const r1csStoragePath = `${ceremonyPrefix}/circuits/${circuit.prefix}`

        // Upload.
        await uploadFileToStorage(r1csLocalPathAndFileName, `${r1csStoragePath}/${r1csFileName}`)

        spinner.stop()

        console.log(`${theme.success} ${r1csFileName} stored`)

        // ZKEY.
        spinner = customSpinner(`Uploading .zkey file...`, "clock")
        spinner.start()

        const zkeyStoragePath = `${ceremonyPrefix}/circuits/${circuit.prefix}/contributions`

        // Upload.
        await uploadFileToStorage(zkeyLocalPathAndFileName, `${zkeyStoragePath}/${firstZkeyFileName}`)

        spinner.stop()

        console.log(`${theme.success} ${firstZkeyFileName} stored`)

        // Calculate file hashes.
        circuit.r1csBlake2bHash = blake.blake2bHex(r1csLocalPathAndFileName)
        circuit.ptauBlake2bHash = blake.blake2bHex(ptauLocalPathAndFileName)
        circuit.zkeyBlake2bHash = blake.blake2bHex(zkeyLocalPathAndFileName)

        // Add ptau file name.
        circuit.ptauFilename = smallestPtauForCircuit

        circuits[i] = circuit
      }

      /** POPULATE DB */
      spinner = customSpinner(`Storing data on database...`, "clock")
      spinner.start()

      // CEREMONY (collection).
      const ceremonyRef = await setDocument("ceremonies", {
        title: ceremonyInputData.title,
        description: ceremonyInputData.description,
        startDate: ceremonyInputData.startDate.valueOf(),
        endDate: ceremonyInputData.endDate.valueOf(),
        prefix: ceremonyPrefix,
        state: CeremonyState.SCHEDULED,
        type: CeremonyType.PHASE2,
        coordinatorId: user.uid,
        lastUpdated: getServerTimestampInMillis()
      })

      // CIRCUITS (ceremony subcollection).
      for (const circuit of circuits) {
        await setDocument(`ceremonies/${ceremonyRef.id}/circuits`, {
          ...circuit,
          avgContributionTime: convertSecondsToMillis(circuit.avgContributionTime),
          lastUpdated: getServerTimestampInMillis()
        })
      }
      spinner.stop()

      console.log(
        `\nYou have successfully completed your ${theme.bold(
          theme.monoD(ceremonyInputData.title)
        )} ceremony setup! Congratulations, @${theme.monoD(theme.bold(ghUsername))} 🎉`
      )
    } else console.log(`\nFarewell, @${theme.monoD(theme.bold(ghUsername))}`)

    process.exit(0)
  } catch (err: any) {
    if (err) {
      const error = err.toString()
      console.error(`\n${theme.error} Oops, something went wrong: \n${error}`)

      process.exit(1)
    }
  }
}

export default setup
