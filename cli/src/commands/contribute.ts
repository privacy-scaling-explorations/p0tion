#!/usr/bin/env node

import clear from "clear"
import figlet from "figlet"
import dotenv from "dotenv"
import { DocumentSnapshot, onSnapshot, where } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { Ora } from "ora"
import winston from "winston"
import { Timer } from "timer-node"
import { zKey } from "snarkjs"
import open from "open"
import { checkForStoredOAuthToken, getCurrentAuthUser, signIn } from "../lib/auth.js"
import theme from "../lib/theme.js"
import { askForCeremonySelection, askForConfirmation, askForEntropy } from "../lib/prompts.js"
import { CeremonyState, FirebaseDocumentInfo, ParticipantStatus } from "../../types/index.js"
import {
  customSpinner,
  formatZkeyIndex,
  fromQueryToFirebaseDocumentInfo,
  getGithubUsername,
  publishGist
} from "../lib/utils.js"
import {
  getAllCollectionDocs,
  getDocumentById,
  initServices,
  queryCollection,
  downloadFileFromStorage,
  uploadFileToStorage
} from "../lib/firebase.js"
import { cleanDir, readFile, writeFile } from "../lib/files.js"

dotenv.config()

/**
 * Return some random values to be used as entropy.
 * @dev took inspiration from here https://github.com/glamperd/setup-mpc-ui/blob/master/client/src/state/Compute.tsx#L112.
 * @returns <Uint8Array>
 */
const getRandomEntropy = (): Uint8Array => new Uint8Array(64).map(() => Math.random() * 256)

/**
 * Retrieve all circuits associated to a ceremony.
 * @param ceremonyId <string> - the identifier of the ceremony.
 * @returns Promise<Array<FirebaseDocumentInfo>>
 */
const getCeremonyCircuits = async (ceremonyId: string): Promise<Array<FirebaseDocumentInfo>> =>
  fromQueryToFirebaseDocumentInfo(await getAllCollectionDocs(`ceremonies/${ceremonyId}/circuits`)).sort(
    (a: FirebaseDocumentInfo, b: FirebaseDocumentInfo) => a.data.sequencePosition - b.data.sequencePosition
  )

/**
 * Query for opened ceremonies documents and return their data (if any).
 * @returns <Promise<Array<FirebaseDocumentInfo>>>
 */
const getOpenedCeremonies = async (): Promise<Array<FirebaseDocumentInfo>> => {
  const runningStateCeremoniesQuerySnap = await queryCollection("ceremonies", [
    where("state", "==", CeremonyState.OPENED)
  ])

  if (runningStateCeremoniesQuerySnap.empty && runningStateCeremoniesQuerySnap.size === 0) {
    console.error(
      theme.redD("We are sorry but there are no ceremonies running at this moment. Please try again later!")
    )

    process.exit(0)
  }

  return fromQueryToFirebaseDocumentInfo(runningStateCeremoniesQuerySnap.docs)
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
    const verifyContribution = httpsCallable(firebaseFunctions, "verifyContribution")

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

    // Custom spinner variable.
    let spinner: Ora
    // Custom logger (useful to handle transcript information).
    let transcriptLogger: winston.Logger
    let attestation = `Hey, I'm ${ghUsername} and I have contributed to the ${ceremony.data.title} MPC Phase2 Trusted Setup ceremony.\nThe following are my contribution signatures:`
    // Variable for entropy.
    let entropy = ""
    let path = ""

    // TODO: to be checked in case of crash etc. (use newlyParticipant value).
    // Clean contributions and transcripts dirs.
    cleanDir("./contributions/")
    cleanDir("./transcripts/")

    // Prompt for entropy.
    const { confirmation } = await askForConfirmation(`Do you prefer to enter entropy manually?`)

    if (!confirmation) entropy = getRandomEntropy().toString()
    else entropy = await askForEntropy()

    // Listen to changes on the user-related participant document.
    const unsubscriberForParticipantDocument = onSnapshot(
      participantDoc.ref,
      async (participantDocSnap: DocumentSnapshot) => {
        // Get updated data from snap.
        const newParticipantData = participantDocSnap.data()

        if (!newParticipantData) throw new Error(`Something went wrong while retrieving your data`)

        const { contributionProgress, status } = newParticipantData

        // Get the circuit.
        const circuit = circuits[contributionProgress - 1]

        // Participant needs to start contributing.
        if (status === ParticipantStatus.CONTRIBUTING) {
          // Compute zkey indexes.
          const currentProgress = circuit.data.waitingQueue.completedContributions
          const currentZkeyIndex = formatZkeyIndex(currentProgress)
          const nextZkeyIndex = formatZkeyIndex(currentProgress + 1)

          console.log(theme.monoD(theme.bold(`\n- Circuit # ${theme.yellowD(`${circuit.data.sequencePosition}`)}`)))

          transcriptLogger = winston.createLogger({
            level: "info",
            format: winston.format.printf((log) => log.message),
            transports: [
              // Write all logs with importance level of `info` to `transcript.json`.
              new winston.transports.File({
                filename: `./transcripts/${circuit.data.prefix}_${nextZkeyIndex}_transcript.log`,
                level: "info"
              })
            ]
          })
          transcriptLogger.info(
            `Contribution transcript for ${circuit.data.prefix} phase 2 contribution.\nContributor # ${Number(
              nextZkeyIndex
            )} (${ghUsername})\n`
          )

          // 1. Download last contribution.
          spinner = customSpinner("Downloading last .zkey file...", "clock")
          spinner.start()

          path = `${ceremony.data.prefix}/circuits/${circuit.data.prefix}/contributions/${circuit.data.prefix}_${currentZkeyIndex}.zkey`
          const content = await downloadFileFromStorage(path)
          writeFile(
            `./${path.substring(path.indexOf("contributions/"))}`,
            content,
            `${theme.success} zKey downloaded!`,
            spinner
          )

          // 3. Compute the new contribution.
          spinner = customSpinner("Computing contribution...", "clock")
          spinner.start()

          // Keep track of contribution computation time.
          const timer = new Timer({ label: "contributionTime" })
          timer.start()

          await zKey.contribute(
            `./contributions/${circuit.data.prefix}_${currentZkeyIndex}.zkey`,
            `./contributions/${circuit.data.prefix}_${nextZkeyIndex}.zkey`,
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

          // 4. Store files.
          // Upload .zkey file.
          spinner = customSpinner("Uploading your contribution...", "clock")
          spinner.start()

          path = `${ceremony.data.prefix}/circuits/${circuit.data.prefix}/contributions/${circuit.data.prefix}_${nextZkeyIndex}.zkey`
          await uploadFileToStorage(`./${path.substring(path.indexOf("contributions/"))}`, path)

          spinner.stop()
          console.log(`${theme.success} Contribution stored!`)

          // Upload contribution transcript.
          spinner = customSpinner("Uploading your transcript...", "clock")
          spinner.start()

          path = `${ceremony.data.prefix}/circuits/${circuit.data.prefix}/transcripts/${circuit.data.prefix}_${nextZkeyIndex}_transcript.log`
          await uploadFileToStorage(`./${path.substring(path.indexOf("transcripts/"))}`, path)

          spinner.stop()
          console.log(`${theme.success} Transcript stored!`)

          // Verify contribution.
          spinner = customSpinner("Verifying your contribution...", "clock")
          spinner.start()

          const verified = await verifyContribution({
            ceremonyId: ceremony.id,
            circuitId: circuit.id
          })

          spinner.stop()

          console.log(`${verified ? theme.success : theme.error} Contribution ${verified ? `valid` : `not valid`}`)

          const transcript = readFile(`./${path.substring(path.indexOf("transcripts/"))}`)
          const matchContributionHash = transcript
            .toString()
            .match(/Contribution.+Hash.+\n\t\t.+\n\t\t.+\n.+\n\t\t.+\n/)

          if (matchContributionHash) {
            attestation += `\n\nCircuit: ${circuit.data.prefix}\nContributor # ${Number(
              nextZkeyIndex
            )}\n${matchContributionHash[0].replace("\n\t\t", "")}`
          }
        }

        if (status === ParticipantStatus.CONTRIBUTED && contributionProgress === numberOfCircuits + 1) {
          // Check if participant has finished the contribution for each circuit.
          console.log(
            theme.monoD(
              `\n\nCongratulations @${theme.bold(ghUsername)}! 🎉 You have correctly contributed to ${theme.yellowD(
                contributionProgress - 1
              )} out of ${theme.yellowD(numberOfCircuits)} circuits!\n\n`
            )
          )

          spinner = customSpinner("Generating attestation...", "clock")
          spinner.start()

          await writeFile(
            `./transcripts/${ceremony.data.prefix}_attestation_${ghUsername}.log`,
            Buffer.from(attestation),
            `${theme.success} Attestation generated! You can find your attestation on the \`transcripts/\` folder\n`,
            spinner
          )

          spinner.stop()

          spinner = customSpinner("Uploading a Github Gist...", "clock")
          spinner.start()

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
    // TODO: listen to circuits w queues for feedbacks?
  } catch (err: any) {
    if (err) {
      const error = err.toString()
      console.error(`\n${theme.error} Oops, something went wrong: \n${error}`)

      process.exit(1)
    }
  }
}

export default contribute
