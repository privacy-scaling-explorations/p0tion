import { DocumentSnapshot, onSnapshot } from "firebase/firestore"
import { Functions, httpsCallable } from "firebase/functions"
import { zKey } from "snarkjs"
import { Timer } from "timer-node"
import winston from "winston"
import open from "open"
import { FirebaseDocumentInfo, ParticipantStatus } from "../../types/index.js"
import { collections, emojis, paths, symbols, theme } from "./constants.js"
import { readFile, writeFile } from "./files.js"
import { downloadFileFromStorage, uploadFileToStorage } from "./firebase.js"
import { getCeremonyCircuits } from "./queries.js"
import {
  convertMillisToSeconds,
  convertToDoubleDigits,
  customSpinner,
  formatZkeyIndex,
  getSecondsMinutesHoursFromMillis,
  publishGist,
  sleep,
  terminate
} from "./utils.js"
import { GENERIC_ERRORS, showError } from "./errors.js"

/**
 * Return the index of a given participant in a circuit waiting queue.
 * @param contributors <Array<string>> - the list of the contributors in queue for a circuit.
 * @param participantId <string> - the unique identifier of the participant.
 * @returns <number>
 */
const getParticipantPositionInQueue = (contributors: Array<string>, participantId: string): number =>
  contributors.indexOf(participantId) + 1

/**
 * Listen to circuit document changes and reacts in realtime.
 * @param participantId <string> - the unique identifier of the contributor.
 * @param circuit <FirebaseDocumentInfo> - the document information about the current circuit.
 */
const listenToCircuitChanges = (participantId: string, circuit: FirebaseDocumentInfo) => {
  const unsubscriberForCircuitDocument = onSnapshot(circuit.ref, async (circuitDocSnap: DocumentSnapshot) => {
    // Get updated data from snap.
    const newCircuitData = circuitDocSnap.data()

    if (!newCircuitData) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

    // Get data.
    const { avgTimings, waitingQueue } = newCircuitData!
    const { avgContributionTime, avgVerificationTime } = avgTimings

    // Get updated position for contributor in the queue.
    const newParticipantPositionInQueue = getParticipantPositionInQueue(waitingQueue.contributors, participantId)

    let newEstimatedWaitingTime = 0

    // Show new time estimation.
    if (avgContributionTime > 0 && avgVerificationTime > 0)
      newEstimatedWaitingTime = (avgContributionTime + avgVerificationTime) * (newParticipantPositionInQueue - 1)

    const {
      seconds: estSeconds,
      minutes: estMinutes,
      hours: estHours
    } = getSecondsMinutesHoursFromMillis(newEstimatedWaitingTime)
    const showTimeEstimation = `${
      newEstimatedWaitingTime > 0
        ? `> The estimated waiting time is ${theme.magenta(
            theme.bold(
              `${convertToDoubleDigits(estHours)}:${convertToDoubleDigits(estMinutes)}:${convertToDoubleDigits(
                estSeconds
              )} ${emojis.clock}`
            )
          )}`
        : `> There is no time estimation since the first contributor has not completed the contribution yet`
    }`

    // Check if is the current contributor.
    if (newParticipantPositionInQueue === 1) {
      console.log(theme.bold(`\n${symbols.success} Your contribution will start soon ${emojis.rocket}`))
      unsubscriberForCircuitDocument()
    } else {
      console.log(
        theme.bold(
          `\n${symbols.info} You have to wait ${theme.bold(
            theme.magenta(newParticipantPositionInQueue - 1)
          )} contributors before starting your computation!\n${showTimeEstimation}`
        )
      )
      console.log(
        theme.bold(
          `> Participant ${theme.magenta(theme.bold(waitingQueue.currentContributor))} is currently contributing ${
            emojis.fire
          }`
        )
      )
    }
  })
}

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
  // Verify contribution callable Cloud Function.
  const verifyContribution = httpsCallable(firebaseFunctions, "verifyContribution", { timeout: 540000 })

  // Extract data from circuit.
  const currentProgress = circuit.data.waitingQueue.completedContributions
  const { avgTimings } = circuit.data

  // Compute zkey indexes.
  const currentZkeyIndex = formatZkeyIndex(currentProgress)
  const nextZkeyIndex = formatZkeyIndex(currentProgress + 1)

  // Transcript filename.
  const transcriptFilename = `${paths.transcriptsPath}/${circuit.data.prefix}_${nextZkeyIndex}.log`

  console.log(theme.bold(`\n- Circuit # ${theme.magenta(`${circuit.data.sequencePosition}`)}`))

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
  let spinner = customSpinner(`Downloading last contribution...`, "clock")
  spinner.start()

  let path = `${ceremony.data.prefix}/${collections.circuits}/${circuit.data.prefix}/${collections.contributions}/${circuit.data.prefix}_${currentZkeyIndex}.zkey`
  const content = await downloadFileFromStorage(path)

  writeFile(`${paths.contributionsPath}/${circuit.data.prefix}_${currentZkeyIndex}.zkey`, content)

  spinner.stop()
  console.log(`${symbols.success} Last contribution (#${theme.bold(currentZkeyIndex)}) correctly downloaded`)

  // 2. Compute the new contribution.
  spinner = customSpinner(
    `Computing contribution... ${
      avgTimings.avgContributionTime > 0
        ? `(est. time ${theme.magenta(theme.bold(convertMillisToSeconds(avgTimings.avgContributionTime)))} seconds)`
        : ``
    }`,
    "clock"
  )

  spinner.start()

  await zKey.contribute(
    `${paths.contributionsPath}/${circuit.data.prefix}_${currentZkeyIndex}.zkey`,
    `${paths.contributionsPath}/${circuit.data.prefix}_${nextZkeyIndex}.zkey`,
    ghUsername,
    entropy,
    transcriptLogger
  )
  timer.stop()

  await sleep(2000)

  spinner.stop()

  // Estimate contribution time.
  const contributionTimeInMillis = timer.ms()
  const {
    seconds: contributionSeconds,
    minutes: contributionMinutes,
    hours: contributionHours
  } = getSecondsMinutesHoursFromMillis(timer.ms())
  console.log(
    `${symbols.success} Contribution computation took ${theme.bold(
      `${convertToDoubleDigits(contributionHours)}:${convertToDoubleDigits(
        contributionMinutes
      )}:${convertToDoubleDigits(contributionSeconds)}`
    )}`
  )

  // 3. Store files.
  // Upload .zkey file.
  spinner = customSpinner("Storing your contribution...", "clock")
  spinner.start()

  path = `${ceremony.data.prefix}/${collections.circuits}/${circuit.data.prefix}/${collections.contributions}/${circuit.data.prefix}_${nextZkeyIndex}.zkey`
  await uploadFileToStorage(`${paths.contributionsPath}/${circuit.data.prefix}_${nextZkeyIndex}.zkey`, path)

  spinner.stop()
  console.log(`${symbols.success} Your contribution (#${theme.bold(nextZkeyIndex)}) correctly saved on storage`)

  spinner = customSpinner(
    `Verifying your contribution... ${
      avgTimings.avgVerificationTime > 0
        ? `(est. time ${theme.magenta(theme.bold(convertMillisToSeconds(avgTimings.avgVerificationTime)))} seconds)`
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

  if (!data) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

  spinner.stop()

  const { valid, verificationTimeInMillis } = data
  const {
    seconds: verificationSeconds,
    minutes: verificationMinutes,
    hours: verificationHours
  } = getSecondsMinutesHoursFromMillis(verificationTimeInMillis)
  console.log(
    `${symbols.success} Verification check took ${theme.bold(
      `${convertToDoubleDigits(verificationSeconds)}:${convertToDoubleDigits(
        verificationMinutes
      )}:${convertToDoubleDigits(verificationHours)}`
    )}`
  )

  console.log(
    `${
      valid
        ? `${symbols.success} Verification ${theme.bold("passed")} ${emojis.fire}`
        : `${symbols.error} Verification ${theme.bold("not passed")} ${emojis.dizzy}`
    }`
  )

  // 5. Generate attestation from single contribution transcripts from each circuit.
  const transcript = readFile(transcriptFilename)
  const matchContributionHash = transcript.toString().match(/Contribution.+Hash.+\n\t\t.+\n\t\t.+\n.+\n\t\t.+\n/)

  if (!matchContributionHash) showError(GENERIC_ERRORS.GENERIC_CONTRIBUTION_HASH_INVALID, true)

  const contributionAttestation = matchContributionHash?.at(0)?.replace("\n\t\t", "")

  return `${attestation}\n\nCircuit # ${circuit.data.sequencePosition} (${circuit.data.prefix})\nContributor # ${Number(
    nextZkeyIndex
  )}\n${contributionAttestation}`
}

// Listen to changes on the user-related participant document.
export default (
  participantDoc: FirebaseDocumentInfo,
  ceremony: FirebaseDocumentInfo,
  circuits: Array<FirebaseDocumentInfo>,
  firebaseFunctions: Functions,
  ghToken: string,
  ghUsername: string,
  entropy: string
) => {
  // Attestation preamble.
  let attestation = `Hey, I'm ${ghUsername} and I have contributed to the ${ceremony.data.title} MPC Phase2 Trusted Setup ceremony.\nThe following are my contribution signatures:`
  // Get number of circuits for the selected ceremony.
  const numberOfCircuits = circuits.length

  // Listen to participant document changes.
  const unsubscriberForParticipantDocument = onSnapshot(
    participantDoc.ref,
    async (participantDocSnap: DocumentSnapshot) => {
      // Get updated data from snap.
      const newParticipantData = participantDocSnap.data()

      if (!newParticipantData) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

      // Extract updated participant document data.
      const { contributionProgress, status } = newParticipantData!
      const participantId = participantDoc.id

      // A. Do not have completed the contributions for each circuit; move to the next one.
      if (contributionProgress > 0 && contributionProgress <= circuits.length) {
        // Get updated circuits data.
        const circuits = await getCeremonyCircuits(ceremony.id)
        const circuit = circuits[contributionProgress - 1]
        const { waitingQueue } = circuit.data

        // If the participant is in `waiting` status, he/she must receive updates from the circuit's waiting queue.
        if (status === ParticipantStatus.WAITING) listenToCircuitChanges(participantId, circuit)

        // If the participant is in `contributing` status and is the current contributor, he/she must compute the contribution.
        if (status === ParticipantStatus.CONTRIBUTING && waitingQueue.currentContributor === participantId)
          // Compute the contribution.
          attestation = await makeContribution(ceremony, circuit, entropy, ghUsername, attestation, firebaseFunctions)
      }

      // B. Already contributed to each circuit.
      if (status === ParticipantStatus.CONTRIBUTED && contributionProgress === numberOfCircuits + 1) {
        // Check if participant has finished the contribution for each circuit.
        console.log(
          `\nCongratulations @${theme.bold(ghUsername)}! ${
            emojis.tada
          } You have correctly contributed to ${theme.magenta(
            theme.bold(contributionProgress - 1)
          )} out of ${theme.magenta(theme.bold(numberOfCircuits))} circuits!\n`
        )

        let spinner = customSpinner("Generating public attestation...", "clock")
        spinner.start()

        writeFile(`${paths.attestationPath}/${ceremony.data.prefix}_attestation.log`, Buffer.from(attestation))
        await sleep(2000)
        spinner.stop()

        console.log(`\n${symbols.success} Public attestation ready to be published`)

        spinner = customSpinner("Uploading public attestation as Github Gist...", "clock")
        spinner.start()

        const gistUrl = await publishGist(ghToken, attestation, ceremony.data.prefix, ceremony.data.title)
        await sleep(2000)
        // TODO: If fails for permissions problems, ask to do manually.

        spinner.stop()
        console.log(
          `${symbols.success} Public attestation ${theme.bold(
            theme.underlined(gistUrl)
          )} successfully published on Github ${emojis.tada}`
        )

        // Attestation link via Twitter.
        const attestationTweet = `https://twitter.com/intent/tweet?text=I%20contributed%20to%20the%20MACI%20Phase%20Trusted%20Setup%20ceremony!%20You%20can%20contribute%20here:%20https://github.com/quadratic-funding/mpc-phase2-suite%20You%20can%20view%20my%20attestation%20here:%20${gistUrl}%20#Ethereum%20#ZKP%20#PSE`

        console.log(
          `\nWe appreciate your contribution to preserving the ${ceremony.data.title} security! ${emojis.key} Therefore, we kindly invite you to share about your participation in our ceremony! (nb. The page should open by itself, otherwise click on the link below! ${emojis.pointDown})\n\n${attestationTweet}`
        )

        await open(`http://twitter.com/intent/tweet?text=${attestationTweet}`)

        unsubscriberForParticipantDocument()
        terminate(ghUsername)
      }
    }
  )
}
