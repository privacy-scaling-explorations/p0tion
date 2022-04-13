#!/usr/bin/env node

import clear from "clear"
import figlet from "figlet"
import dotenv from "dotenv"
import { zKey, r1cs } from "snarkjs"
import winston from "winston"
import { serverTimestamp } from "firebase/firestore"
import blake from "blakejs"
import theme from "../lib/theme.js"
import { checkForStoredOAuthToken, getCurrentAuthUser, onlyCoordinator, signIn } from "../lib/auth.js"
import { initServices, setDocument, uploadFileToStorage } from "../lib/firebase.js"
import {
  customSpinner,
  estimatePoT,
  extractCeremonyPrefixFromTitle,
  extractCircuitPrefixFromName,
  getCircuitMetadataFromR1csFile,
  getGithubUsername
} from "../lib/utils.js"
import { askCeremonyInputData, askCircuitInputData, askForConfirmation, askForPtauSelection } from "../lib/prompts.js"
import { cleanDir, readFile } from "../lib/files.js"
import { CeremonyState, CeremonyType, Circuit, CircuitInputData } from "../../types/index.js"

dotenv.config()

/**
 * Setup a new Groth16 zkSNARK Phase 2 Trusted Setup ceremony.
 */
async function setup() {
  clear()

  // Custom spinner.
  let spinner

  // Circuit data state.
  let addAnotherCircuit = true
  let circuitSequencePosition = 1
  const circuitsInputData: Array<CircuitInputData> = []
  const circuits: Array<Circuit> = []

  // Local paths.
  const ptauLocalDirPath = `./circuits/ptau/`
  const r1csLocalDirPath = `./circuits/r1cs/`
  const infoLocalDirPath = `./circuits/info/`
  const zkeyLocalDirPath = `./zkeys/`

  console.log(theme.yellowD(figlet.textSync("MPC Phase2 Suite", { font: "ANSI Shadow", horizontalLayout: "full" })))

  /** CORE */
  try {
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

    console.log(theme.monoD(`Greetings, @${theme.monoD(theme.bold(ghUsername))}!\n`))

    // Check custom claims for coordinator role.
    await onlyCoordinator(user)

    // Ask for ceremony input data.
    const ceremonyInputData = await askCeremonyInputData()
    const ceremonyPrefix = extractCeremonyPrefixFromTitle(ceremonyInputData.title)

    // Clear directory.
    cleanDir("./circuits/info")

    while (addAnotherCircuit) {
      console.log(theme.monoD(theme.bold(`\nCircuit # ${theme.yellowD(`${circuitSequencePosition}`)}\n`)))

      // Ask for circuit input data.
      const circuitInputData = await askCircuitInputData()

      const circuitPrefix = extractCircuitPrefixFromName(circuitInputData.name)
      const r1csInfoFilePath = `${infoLocalDirPath}${circuitPrefix}_r1cs_info.log`
      const r1csFilePath = `${r1csLocalDirPath}${circuitPrefix}.r1cs`

      // Custom logger.
      const logger = winston.createLogger({
        level: "info",
        transports: new winston.transports.File({
          filename: r1csInfoFilePath,
          format: winston.format.printf((log) => log.message),
          level: "info"
        })
      })

      process.stdout.write("\n")
      spinner = customSpinner(`Looking for ${circuitPrefix}.r1cs in \`circuits\\r1cs\` folder... \n\n`, "clock")
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

      console.log(`${theme.success} Circuit info from .r1cs`)

      process.stdout.write("\n")

      // Ask for another circuit.
      const { confirmation } = await askForConfirmation(
        "Do you want to add more circuits for the ceremony?",
        "Yes",
        "No"
      )

      if (!confirmation) addAnotherCircuit = false
      else circuitSequencePosition += 1
    }

    // Show summary.
    console.log(`\n°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°`)
    console.log(theme.yellowD(theme.bold(`\nCEREMONY SUMMARY`)))
    console.log(
      theme.monoD(theme.bold(`\n${ceremonyInputData.title}`)),
      theme.monoD(theme.italic(`\n${ceremonyInputData.description}`)),
      theme.monoD(
        `\n\nfrom ${theme.bold(ceremonyInputData.startDate.toString())} to ${theme.bold(
          ceremonyInputData.endDate.toString()
        )}`
      )
    )

    for (let i = 0; i < circuitsInputData.length; i += 1) {
      const circuitInputData = circuitsInputData[i]

      // Read file.
      const r1csInfoFilePath = `./circuits/info/${circuitInputData.prefix}_r1cs_info.log`
      const circuitInfo = readFile(r1csInfoFilePath).toString()

      // Extract info from file.
      const curve = getCircuitMetadataFromR1csFile(circuitInfo, /Curve: .+\n/s)
      const wires = Number(getCircuitMetadataFromR1csFile(circuitInfo, /# of Wires: .+\n/s))
      const constraints = Number(getCircuitMetadataFromR1csFile(circuitInfo, /# of Constraints: .+\n/s))
      const privateInputs = Number(getCircuitMetadataFromR1csFile(circuitInfo, /# of Private Inputs: .+\n/s))
      const publicOutputs = Number(getCircuitMetadataFromR1csFile(circuitInfo, /# of Public Inputs: .+\n/s))
      const labels = Number(getCircuitMetadataFromR1csFile(circuitInfo, /# of Labels: .+\n/s))
      const outputs = Number(getCircuitMetadataFromR1csFile(circuitInfo, /# of Outputs: .+\n/s))
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
      console.log(theme.monoD(theme.bold(`\n- CIRCUIT # ${theme.yellowD(`${circuitInputData.sequencePosition}`)}`)))
      console.log(
        theme.monoD(`\n${theme.bold(circuitInputData.name)}`),
        theme.monoD(theme.italic(`\n${circuitInputData.description}`)),
        theme.monoD(
          theme.monoD(
            `\n\nAverage Contribution Time ${theme.bold(theme.yellowD(circuitInputData.avgContributionTime))} seconds`
          )
        ),
        theme.monoD(theme.monoD(`\nCurve: ${theme.bold(theme.yellowD(curve))}`)),
        theme.monoD(theme.monoD(`\n# Wires: ${theme.bold(theme.yellowD(wires))}`)),
        theme.monoD(theme.monoD(`\n# Constraints: ${theme.bold(theme.yellowD(constraints))}`)),
        theme.monoD(theme.monoD(`\n# Private Inputs: ${theme.bold(theme.yellowD(privateInputs))}`)),
        theme.monoD(theme.monoD(`\n# Public Inputs: ${theme.bold(theme.yellowD(publicOutputs))}`)),
        theme.monoD(theme.monoD(`\n# Labels: ${theme.bold(theme.yellowD(labels))}`)),
        theme.monoD(theme.monoD(`\n# Outputs: ${theme.bold(theme.yellowD(outputs))}`)),
        theme.monoD(theme.monoD(`\n# PoT: ${theme.bold(theme.yellowD(pot))}`))
      )
    }

    console.log(`\n°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°\n`)

    // Ask for confirmation.
    const { confirmation } = await askForConfirmation(
      "Do you confirm that you want to create a ceremony with the above information?",
      "Yes",
      "No"
    )

    if (confirmation) {
      cleanDir("./zkeys/")

      console.log(`\n**********************************************************************\n`)

      const uploadedPtaus: Array<string> = []
      for (let i = 0; i < circuits.length; i += 1) {
        const circuit = circuits[i]

        /** SETUP */
        console.log(theme.monoD(theme.bold(`\n- SETUP FOR CIRCUIT # ${theme.yellowD(`${circuit.sequencePosition}`)}`)))

        process.stdout.write("\n")

        // Ask for .ptau selection.
        const ptauFileName = await askForPtauSelection(ptauLocalDirPath, circuit.metadata.pot)
        const r1csFileName = `${circuit.prefix}.r1cs`
        const zkeyFileName = `${circuit.prefix}_00000.zkey`
        const r1csPathAndFileName = `${r1csLocalDirPath}${r1csFileName}`
        const zkeyPathAndFileName = `${zkeyLocalDirPath}${zkeyFileName}`
        const ptauPathAndFileName = `${ptauLocalDirPath}${ptauFileName}`

        // Compute first .zkey file (without any contribution).
        await zKey.newZKey(r1csPathAndFileName, ptauPathAndFileName, zkeyPathAndFileName, console)

        // Validate.
        await zKey.verifyFromR1cs(r1csPathAndFileName, ptauPathAndFileName, zkeyPathAndFileName)

        process.stdout.write("\n")
        console.log(`${theme.success} ${circuit.name} ZKey Ok!\n`)

        /** UPLOAD */

        // PTAU.
        spinner = customSpinner(`Uploading .ptau file...`, "clock")
        spinner.start()

        if (!uploadedPtaus.filter((fileName: string) => fileName === ptauFileName).length) {
          const ptauStoragePath = `${ceremonyPrefix}/ptau/`

          // Upload.
          await uploadFileToStorage(ptauPathAndFileName, `${ptauStoragePath}${ptauFileName}`)
          uploadedPtaus.push(ptauFileName)

          spinner.stop()

          console.log(`${theme.success} ${ptauFileName} uploaded!\n`)
        } else {
          spinner.stop()

          console.log(`${theme.success} ${ptauFileName} already uploaded!\n`)
        }

        // R1CS.
        spinner = customSpinner(`Uploading .r1cs file...`, "clock")
        spinner.start()

        const r1csStoragePath = `${ceremonyPrefix}/circuits/${circuit.prefix}/`

        // Upload.
        await uploadFileToStorage(r1csPathAndFileName, `${r1csStoragePath}${r1csFileName}`)

        spinner.stop()

        console.log(`${theme.success} ${r1csFileName} uploaded!\n`)

        // ZKEY.
        spinner = customSpinner(`Uploading .zkey file...`, "clock")
        spinner.start()

        const zkeyStoragePath = `${ceremonyPrefix}/circuits/${circuit.prefix}/contributions/`

        // Upload.
        await uploadFileToStorage(zkeyPathAndFileName, `${zkeyStoragePath}${zkeyFileName}`)

        spinner.stop()

        console.log(`${theme.success} ${zkeyFileName} uploaded!\n`)

        // Calculate file hashes.
        circuit.r1csBlake2bHash = blake.blake2bHex(r1csPathAndFileName)
        circuit.zkeyBlake2bHash = blake.blake2bHex(zkeyPathAndFileName)
        circuit.ptauBlake2bHash = blake.blake2bHex(ptauPathAndFileName)

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
        lastUpdate: serverTimestamp()
      })

      // CIRCUITS (ceremony subcollection).
      for (const circuit of circuits) {
        await setDocument(`ceremonies/${ceremonyRef.id}/circuits`, {
          ...circuit,
          lastUpdate: serverTimestamp()
        })
      }
      spinner.stop()
      console.log(`${theme.success} Data correctly stored!`)

      console.log(
        `\nYou have successfully completed your ceremony setup! Congratulations, @${theme.monoD(
          theme.bold(ghUsername)
        )} 🎉`
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
