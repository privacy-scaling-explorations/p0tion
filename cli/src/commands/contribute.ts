#!/usr/bin/env node

import clear from "clear"
import figlet from "figlet"
import dotenv from "dotenv"
import { zKey } from "snarkjs"
import { Timer } from "timer-node"
import winston from "winston"
import { Ora } from "ora"
import theme from "../lib/theme.js"
import { checkForStoredOAuthToken, signIn } from "../lib/auth.js"
import {
  downloadFileFromStorage,
  getAllCollectionDocs,
  initServices,
  queryCollection,
  uploadFileToStorage
} from "../lib/firebase.js"
import { customSpinner, fromQueryToFirebaseDocumentInfo, getGithubUsername } from "../lib/utils.js"
import { CeremonyState, FirebaseDocumentInfo } from "../../types/index.js"
import { askForCeremonySelection, askForEntropy } from "../lib/prompts.js"
import { cleanDir, writeFile } from "../lib/files.js"

dotenv.config()

/**
 * Query for running ceremonies documents and return their data (if any).
 * @returns <Promise<Array<FirebaseDocumentInfo>>>
 */
const getRunningCeremoniesDocsData = async (): Promise<Array<FirebaseDocumentInfo>> => {
  const runningCeremoniesQuerySnap = await queryCollection("ceremonies", "state", "==", CeremonyState.RUNNING)

  if (runningCeremoniesQuerySnap.empty && runningCeremoniesQuerySnap.size === 0)
    throw new Error("We are sorry but there are no ceremonies running at this moment. Please try again later!")

  return fromQueryToFirebaseDocumentInfo(runningCeremoniesQuerySnap.docs)
}

/**
 * Contribute command.
 */
async function contribute() {
  clear()

  console.log(theme.yellowD(figlet.textSync("MPC Phase2 Suite", { font: "ANSI Shadow", horizontalLayout: "full" })))

  try {
    // Initialize services.
    await initServices()

    // Get/Set OAuth Token.
    const ghToken = await checkForStoredOAuthToken()

    // Sign in.
    await signIn(ghToken)

    // Get user Github username.
    const ghUsername = await getGithubUsername(ghToken)

    console.log(theme.monoD(`Greetings, @${theme.bold(ghUsername)}!\n`))

    // Get running cerimonies info (if any).
    const runningCeremoniesDocs = await getRunningCeremoniesDocsData()

    // Ask to select a ceremony.
    const ceremony = await askForCeremonySelection(runningCeremoniesDocs)

    // Get circuits for selected running ceremony.
    const circuits = fromQueryToFirebaseDocumentInfo(await getAllCollectionDocs(`ceremonies/${ceremony.id}/circuits`))

    // TODO: add circuit-based queue management.
    const mockQueuePosition = 1

    let spinner: Ora
    let path: string
    let transcriptLogger: winston.Logger

    const orderedCircuits = circuits.sort(
      (a: FirebaseDocumentInfo, b: FirebaseDocumentInfo) => a.data.sequencePosition - b.data.sequencePosition
    )

    // Clean zkeys and transcripts dirs.
    cleanDir("./zkeys/")
    cleanDir("./transcripts/")

    for (const circuit of orderedCircuits) {
      console.log(theme.monoD(theme.bold(`\n- Circuit # ${theme.yellowD(`${circuit.data.sequencePosition}`)}`)))
      console.log(
        theme.monoD(`\n${theme.bold(circuit.data.name)} (${theme.italic(circuit.data.prefix)})`),
        theme.monoD(theme.italic(`\n${circuit.data.description}`)),
        theme.monoD(
          `\n\n2^${theme.bold(circuit.data.powers)} PoT / ${theme.bold(circuit.data.constraints)} constraints`
        ),
        theme.monoD(`\nest. contribution time ${theme.bold(circuit.data.avgContributionTime)} seconds`)
      )
      console.log(
        theme.monoD(
          theme.bold(
            `\nQueue Position: ${theme.yellowD(mockQueuePosition)} - est. waiting time ${theme.yellowD(
              mockQueuePosition * circuit.data.avgContributionTime
            )} seconds\n`
          )
        )
      )

      // TODO: listeners for automated queue management.
      const mockZkeyIndex = "00000"
      const mockNewZkeyIndex = "00001"

      // Logger.
      transcriptLogger = winston.createLogger({
        level: "info",
        format: winston.format.printf((log) => log.message),
        transports: [
          // Write all logs with importance level of `info` to `transcript.json`.
          new winston.transports.File({
            filename: `./transcripts/${circuit.data.prefix}_${mockNewZkeyIndex}_${ghUsername}_transcript.log`,
            level: "info"
          })
        ]
      })
      transcriptLogger.info(
        `Contribution transcript for ${circuit.data.prefix} phase 2 contribution.\nContributor ${Number(
          mockNewZkeyIndex
        )} (${ghUsername})\n`
      )

      /** Contribution process */

      // 1. Download last contribution.
      spinner = customSpinner("Downloading last .zkey file...", "clock")
      path = `${ceremony.data.title}/${circuit.data.prefix}/zkeys/${circuit.data.prefix}.${mockZkeyIndex}.zkey`
      console.log(path)

      spinner.start()

      const content = await downloadFileFromStorage(path)
      writeFile(`./${path.substring(path.indexOf("zkeys/"))}`, content)

      spinner.stop()

      console.log(`${theme.success} Download completed!\n`)

      // 2. Prompt for entropy.
      const entropy = await askForEntropy()
      process.stdout.write("\n")

      // 3. Compute the new contribution.
      spinner = customSpinner("Computing...", "clock")
      const timer = new Timer({ label: "contributionTime" })

      spinner.start()
      timer.start()

      await zKey.contribute(
        `./zkeys/${circuit.data.prefix}.${mockZkeyIndex}.zkey`,
        `./zkeys/${circuit.data.prefix}.${mockNewZkeyIndex}.zkey`,
        ghUsername,
        entropy,
        transcriptLogger
      )

      timer.stop()
      spinner.stop()

      const contributionTime = timer.time()
      console.log(
        `${theme.success} Contribution computed in ${
          contributionTime.d > 0 ? `${theme.yellowD(contributionTime.d)} days ` : ""
        }${contributionTime.h > 0 ? `${theme.yellowD(contributionTime.h)} hours ` : ""}${
          contributionTime.m > 0 ? `${theme.yellowD(contributionTime.m)} minutes ` : ""
        }${
          contributionTime.s > 0
            ? `${theme.yellowD(contributionTime.s)}.${theme.yellowD(contributionTime.ms)} seconds`
            : ""
        }`
      )
      process.stdout.write("\n")

      // 4. Upload to storage (new contribution + transcript).
      spinner = customSpinner("Uploading contribution and transcript...", "clock")

      spinner.start()

      // Upload .zkey file.
      path = `${ceremony.data.title}/${circuit.data.prefix}/zkeys/${circuit.data.prefix}.${mockNewZkeyIndex}.zkey`
      await uploadFileToStorage(`./${path.substring(path.indexOf("zkeys/"))}`, path)
      // Upload contribution transcript.
      path = `${ceremony.data.title}/${circuit.data.prefix}/transcripts/${circuit.data.prefix}_${mockNewZkeyIndex}_${ghUsername}_transcript.log`
      await uploadFileToStorage(`./${path.substring(path.indexOf("transcripts/"))}`, path)

      spinner.stop()

      console.log(`${theme.success} Upload completed!\n`)

      // TODO: contribute verification.
    }

    process.exit(0)
  } catch (err: any) {
    if (err) {
      const error = err.toString()
      console.error(`\n${theme.error} Oops, something went wrong: \n${error}`)

      process.exit(1)
    }
  }
}

export default contribute
