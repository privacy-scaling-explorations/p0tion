#!/usr/bin/env node

import clear from "clear"
import figlet from "figlet"
import dotenv from "dotenv"
import { zKey } from "snarkjs"
import { Timer } from "timer-node"
import winston from "winston"
import { Ora } from "ora"
import clipboard from "clipboardy"
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
import { cleanDir, readFile, writeFile } from "../lib/files.js"

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

    /** Contribution state */
    let spinner: Ora
    let path: string
    let transcriptLogger: winston.Logger
    let attestation = `Hey, I'm ${ghUsername} and I have contributed to the ${ceremony.data.name} MPC Phase2 Trusted Setup ceremony.\nThe following are my contribution signatures:`
    const mockZkeyIndex = "00000"
    const mockNewZkeyIndex = "00001"

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
        `Contribution transcript for ${circuit.data.prefix} phase 2 contribution.\nContributor # ${Number(
          mockNewZkeyIndex
        )} (${ghUsername})\n`
      )

      /** Contribution process */

      // 1. Download last contribution.
      spinner = customSpinner("Downloading last .zkey file...", "clock")
      spinner.start()

      path = `${ceremony.data.title}/${circuit.data.prefix}/zkeys/${circuit.data.prefix}.${mockZkeyIndex}.zkey`
      const content = await downloadFileFromStorage(path)
      writeFile(`./${path.substring(path.indexOf("zkeys/"))}`, content)

      spinner.stop()

      console.log(`${theme.success} Download completed!\n`)

      // 2. Prompt for entropy.
      const entropy = await askForEntropy()
      process.stdout.write("\n")

      // 3. Compute the new contribution.
      spinner = customSpinner("Computing...", "clock")
      spinner.start()

      const timer = new Timer({ label: "contributionTime" })
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
      // TODO: add a ceremony prefix (as for the circuits _).

      const transcript = readFile(`./${path.substring(path.indexOf("transcripts/"))}`)
      const matchContributionHash = transcript.toString().match(/Contribution.+Hash.+\n\t\t.+\n\t\t.+\n.+\n\t\t.+\n/)

      if (matchContributionHash) {
        attestation += `\n\nCircuit: ${circuit.data.prefix}\nContributor # ${Number(
          mockNewZkeyIndex
        )}\n${matchContributionHash[0].replace("\n\t\t", "")}`
      }
    }

    // 5. Public attestation.
    // TODO: read data from db.
    console.log(
      theme.monoD(
        `\n\nCongratulations @${theme.bold(ghUsername)}! 🎉 You have correctly contributed to ${theme.yellowD(
          "2"
        )} out of ${theme.yellowD("2")} circuits!\n`
      )
    )

    spinner = customSpinner("Generating attestation...", "clock")
    spinner.start()
    writeFile(`./transcripts/${ceremony.data.name}_attestation_${ghUsername}.log`, Buffer.from(attestation))
    spinner.stop()
    console.log(
      `${theme.success} Attestation generated! You can find your attestation on the \`transcripts/\` folder\n`
    )

    spinner = customSpinner("Uploading a Github Gist...", "clock")
    spinner.start()
    // TODO: Automatically upload attestation as Gist on Github.
    // TODO: If fails for permissions problems, ask to do manually.
    spinner.stop()
    console.log(`${theme.success} Gist uploaded at ...`)

    // Attestation link via Twitter.
    const attestationTweet = `I contributed to the MACI Phase 2 Trusted Setup ceremony! 🎉\n\nYou can contribute here: https://github.com/quadratic-funding/mpc-phase2-suite\n\nYou can view my attestation here: https://gist.github.com/Jeeiii/fad24ad297c62af3b01633595d7c9f1f\n\n#Ethereum #ZKP #PSE\n`
    clipboard.writeSync(attestationTweet)
    clipboard.readSync()

    console.log(
      `\nWe appreciate your contribution to preserving the ${ceremony.data.title} security! 🗝\nIf you'd like, we have clipboarded the text below to easy share about the ceremony via Twitter\n\n`
    )
    console.log(theme.monoD(attestationTweet))

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
