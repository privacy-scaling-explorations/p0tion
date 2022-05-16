#!/usr/bin/env node

import clear from "clear"
import figlet from "figlet"
import { DocumentSnapshot, onSnapshot } from "firebase/firestore"
import { Functions, httpsCallable } from "firebase/functions"
import { Ora } from "ora"
import { Timer } from "timer-node"
import { zKey } from "snarkjs"
import open from "open"
import winston from "winston"
import { checkForStoredOAuthToken, getCurrentAuthUser, signIn } from "../lib/auth.js"
import theme from "../lib/theme.js"
import { askForCeremonySelection, askForConfirmation, askForEntropy } from "../lib/prompts.js"
import { FirebaseDocumentInfo, ParticipantStatus } from "../../types/index.js"
import {
  convertMillisToSeconds,
  customSpinner,
  formatZkeyIndex,
  getGithubUsername,
  publishGist,
  getRandomEntropy
} from "../lib/utils.js"
import { getDocumentById, initServices, downloadFileFromStorage, uploadFileToStorage } from "../lib/firebase.js"
import { cleanDir, readFile, writeFile } from "../lib/files.js"
import listenToCircuitChanges from "../lib/listeners.js"
import { getOpenedCeremonies, getCeremonyCircuits } from "../lib/queries.js"

/**
 * Compute a new contribution for the participant.
 * @param ceremony <FirebaseDocumentInfo> - the ceremony document.
 * @param circuit <FirebaseDocumentInfo> - the circuit document.
 * @param entropy <any> - the entropy for the contribution.
 * @param ghUsername <string> - the Github username of the user.
 * @param attestation <string> - the attestation for the participant contribution.
 * @param firebaseFunctions <Functions> - the object containing the firebase functions.
 * @returns <Promise<string>> - new updated attestation file.
 */
const makeContribution = async (
  ceremony: FirebaseDocumentInfo,
  circuit: FirebaseDocumentInfo,
  entropy: any,
  ghUsername: string,
  attestation: string,
  firebaseFunctions: Functions
): Promise<string> => {
  const verifyContribution = httpsCallable(firebaseFunctions, "verifyContribution", { timeout: 540000 })

  let path = ""
  let spinner: Ora

  // Compute zkey indexes.
  const currentProgress = circuit.data.waitingQueue.completedContributions
  const { avgTimings } = circuit.data
  const currentZkeyIndex = formatZkeyIndex(currentProgress)
  const nextZkeyIndex = formatZkeyIndex(currentProgress + 1)

  // Transcript filename.
  const transcriptFilename = `./transcripts/${circuit.data.prefix}_${nextZkeyIndex}.log`

  console.log(theme.monoD(theme.bold(`\n- Circuit # ${theme.yellowD(`${circuit.data.sequencePosition}`)}`)))

  const transcriptLogger = winston.createLogger({
    level: "info",
    format: winston.format.printf((log) => log.message),
    transports: [
      // Write all logs with importance level of `info` to `transcript.json`.
      new winston.transports.File({
        filename: transcriptFilename,
        level: "info"
      })
    ]
  })
  transcriptLogger.info(
    `Contribution transcript for ${circuit.data.prefix} phase 2 contribution.\nContributor # ${Number(
      nextZkeyIndex
    )} (${ghUsername})\n`
  )

  // Keep track of contribution computation time.
  const timer = new Timer({ label: "contributionTime" })
  timer.start()

  // 1. Download last contribution.
  spinner = customSpinner("Downloading last .zkey file...", "clock")
  spinner.start()

  path = `${ceremony.data.prefix}/circuits/${circuit.data.prefix}/contributions/${circuit.data.prefix}_${currentZkeyIndex}.zkey`
  const content = await downloadFileFromStorage(path)
  writeFile(`./${path.substring(path.indexOf("contributions/"))}`, content)

  spinner.stop()
  console.log(`${theme.success} zKey downloaded!`)

  // 2. Compute the new contribution.
  spinner = customSpinner(
    `Computing contribution... ${
      avgTimings.avgContributionTime > 0
        ? `(est. time ${theme.yellowD(convertMillisToSeconds(avgTimings.avgContributionTime))} seconds)`
        : ``
    }`,
    "clock"
  )
  spinner.start()

  await zKey.contribute(
    `./contributions/${circuit.data.prefix}_${currentZkeyIndex}.zkey`,
    `./contributions/${circuit.data.prefix}_${nextZkeyIndex}.zkey`,
    ghUsername,
    entropy,
    transcriptLogger
  )

  spinner.stop()

  timer.stop()

  const contributionTime = timer.time()
  const contributionTimeInMillis = timer.ms()
  console.log(
    `${theme.success} Contribution computation took ${
      contributionTime.d > 0 ? `${theme.yellowD(contributionTime.d)} days ` : ""
    }${contributionTime.h > 0 ? `${theme.yellowD(contributionTime.h)} hours ` : ""}${
      contributionTime.m > 0 ? `${theme.yellowD(contributionTime.m)} minutes ` : ""
    }${
      contributionTime.s > 0 ? `${theme.yellowD(contributionTime.s)}.${theme.yellowD(contributionTime.ms)} seconds` : ""
    }`
  )

  // 3. Store files.
  // Upload .zkey file.
  spinner = customSpinner("Uploading your contribution...", "clock")
  spinner.start()

  path = `${ceremony.data.prefix}/circuits/${circuit.data.prefix}/contributions/${circuit.data.prefix}_${nextZkeyIndex}.zkey`
  await uploadFileToStorage(`./${path.substring(path.indexOf("contributions/"))}`, path)

  spinner.stop()
  console.log(`${theme.success} Contribution stored!`)

  spinner = customSpinner(
    `Verifying your contribution... ${
      avgTimings.avgVerificationTime > 0
        ? `(est. time ${theme.yellowD(convertMillisToSeconds(avgTimings.avgVerificationTime))} seconds)`
        : ``
    }`,
    "clock"
  )
  spinner.start()

  // 4. Verify contribution.
  const { data }: any = await verifyContribution({
    ceremonyId: ceremony.id,
    circuitId: circuit.id,
    contributionTimeInMillis,
    ghUsername
  })

  if (!data) throw new Error(`Oops, there were an error when retrieving the result of the contribution verification`)

  spinner.stop()

  const { valid, verificationTimeInMillis } = data

  console.log(
    `${theme.success} Contribution verification took ${theme.yellowD(
      convertMillisToSeconds(verificationTimeInMillis)
    )} seconds`
  )
  console.log(`${valid ? `${theme.success} Contribution okay!` : `${theme.error} Bad contribution!`}`)

  // 5. Generate attestation from single contribution transcripts from each circuit.
  const transcript = readFile(transcriptFilename)
  const matchContributionHash = transcript.toString().match(/Contribution.+Hash.+\n\t\t.+\n\t\t.+\n.+\n\t\t.+\n/)

  if (matchContributionHash) {
    return `${attestation}\n\nCircuit # ${circuit.data.sequencePosition} (${
      circuit.data.prefix
    })\nContributor # ${Number(nextZkeyIndex)}\n${matchContributionHash[0].replace("\n\t\t", "")}`
  }
  // TODO: to be checked and improved.
  throw new Error(`Ops, your contribution hash is invalid!`)
}

/**
 * Contribute command.
 */
async function contribute() {
  clear()

  console.log(theme.yellowD(figlet.textSync("MPC Phase2 Suite", { font: "ANSI Shadow", horizontalLayout: "full" })))

  try {
    // Initialize services.
    const { firebaseFunctions } = await initServices()
    const checkAndRegisterParticipant = httpsCallable(firebaseFunctions, "checkAndRegisterParticipant")

    // Get/Set OAuth Token.
    const ghToken = await checkForStoredOAuthToken()

    // Sign in.
    await signIn(ghToken)

    // Get current authenticated user.
    const user = getCurrentAuthUser()

    // Get user Github username.
    const ghUsername = await getGithubUsername(ghToken)

    console.log(theme.monoD(`Greetings, @${theme.monoD(theme.bold(ghUsername))}!\n`))

    // Get running cerimonies info (if any).
    const runningCeremoniesDocs = await getOpenedCeremonies()

    // Ask to select a ceremony.
    const ceremony = await askForCeremonySelection(runningCeremoniesDocs)

    // Call Cloud Function for participant check and registration.
    const { data: newlyParticipant } = await checkAndRegisterParticipant({ ceremonyId: ceremony.id })

    // Get participant document.
    const participantDoc = await getDocumentById(`ceremonies/${ceremony.id}/participants`, user.uid)

    // Get ceremony circuits.
    const circuits = await getCeremonyCircuits(ceremony.id)
    const numberOfCircuits = circuits.length

    // Get updated data from snap.
    const participantData = participantDoc.data()

    if (!participantData) throw new Error(`Something went wrong while retrieving your data`)

    // Check if already contributed.
    if (!newlyParticipant && participantData.status === ParticipantStatus.CONTRIBUTED) {
      console.log(
        theme.monoD(
          `\nCongratulations @${theme.bold(ghUsername)}! 🎉 You have already contributed to ${theme.yellowD(
            participantData.contributionProgress - 1
          )} out of ${theme.yellowD(numberOfCircuits)} circuits!\n`
        )
      )

      process.exit(0)
    }

    let attestation = `Hey, I'm ${ghUsername} and I have contributed to the ${ceremony.data.title} MPC Phase2 Trusted Setup ceremony.\nThe following are my contribution signatures:`

    // TODO: to be checked in case of crash etc. (use newlyParticipant value).
    // Clean contributions and transcripts dirs.
    cleanDir("./contributions/")
    cleanDir("./transcripts/")
    cleanDir("./attestation/")

    // Prompt for entropy.
    const { confirmation } = await askForConfirmation(`Do you prefer to enter entropy manually?`)

    // @ts-ignore
    const entropy = !confirmation ? getRandomEntropy().toString() : await askForEntropy()

    // Listen to changes on the user-related participant document.
    const unsubscriberForParticipantDocument = onSnapshot(
      participantDoc.ref,
      async (participantDocSnap: DocumentSnapshot) => {
        // Get updated data from snap.
        const newParticipantData = participantDocSnap.data()

        if (!newParticipantData) throw new Error(`Something went wrong while retrieving your data`)

        // Extract updated participant document data.
        const { contributionProgress, status } = newParticipantData
        const participantId = participantDoc.id

        if (contributionProgress > 0 && contributionProgress <= numberOfCircuits) {
          // Get updated circuits data.
          const circuits = await getCeremonyCircuits(ceremony.id)
          const circuit = circuits[contributionProgress - 1]
          const { waitingQueue } = circuit.data

          // If the participant is in `waiting` status, he/she must receive updates from the circuit's waiting queue.
          if (status === ParticipantStatus.WAITING) listenToCircuitChanges(participantId, circuit)

          // If the participant is in `contributing` status and is the current contributor, he/she must compute the contribution.
          if (status === ParticipantStatus.CONTRIBUTING && waitingQueue.currentContributor === participantId) {
            attestation = await makeContribution(ceremony, circuit, entropy, ghUsername, attestation, firebaseFunctions)
          }
        }

        if (status === ParticipantStatus.CONTRIBUTED && contributionProgress === numberOfCircuits + 1) {
          // Check if participant has finished the contribution for each circuit.
          console.log(
            theme.monoD(
              `\nCongratulations @${theme.bold(ghUsername)}! 🎉 You have correctly contributed to ${theme.yellowD(
                contributionProgress - 1
              )} out of ${theme.yellowD(numberOfCircuits)} circuits!\n`
            )
          )

          let spinner = customSpinner("Generating attestation...", "clock")
          spinner.start()

          writeFile(`./attestation/${ceremony.data.prefix}_attestation.log`, Buffer.from(attestation))

          spinner = customSpinner("Uploading a Github Gist...", "clock")

          const gistUrl = await publishGist(ghToken, attestation, ceremony.data.prefix, ceremony.data.title)
          // TODO: If fails for permissions problems, ask to do manually.

          spinner.stop()
          console.log(`${theme.success} Public Attestation ${gistUrl}`)

          // Attestation link via Twitter.
          const attestationTweet = `https://twitter.com/intent/tweet?text=I%20contributed%20to%20the%20MACI%20Phase%20Trusted%20Setup%20ceremony!%20You%20can%20contribute%20here:%20https://github.com/quadratic-funding/mpc-phase2-suite%20You%20can%20view%20my%20attestation%20here:%20${gistUrl}%20#Ethereum%20#ZKP%20#PSE`

          console.log(
            theme.monoD(
              `\nWe appreciate your contribution to preserving the ${
                ceremony.data.title
              } security! 🗝  Therefore, we kindly invite you to share about your participation in our ceremony! (nb. The page should open by itself, otherwise click on the link below! 👇)\n\n${theme.monoD(
                attestationTweet
              )}`
            )
          )

          await open(`http://twitter.com/intent/tweet?text=${attestationTweet}`)

          unsubscriberForParticipantDocument()
          process.exit(0)
        }
      }
    )
  } catch (err: any) {
    if (err) {
      const error = err.toString()
      console.error(`\n${theme.error} Oops, something went wrong: \n${error}`)

      process.exit(1)
    }
  }
}

export default contribute
