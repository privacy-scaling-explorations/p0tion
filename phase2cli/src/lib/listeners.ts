import { DocumentSnapshot, onSnapshot } from "firebase/firestore"
import { Functions } from "firebase/functions"
import open from "open"
import { FirebaseDocumentInfo, ParticipantContributionStep, ParticipantStatus } from "../../types/index.js"
import { emojis, paths, symbols, theme } from "./constants.js"
import { writeFile } from "./files.js"
import { getCeremonyCircuits } from "./queries.js"
import {
  convertToDoubleDigits,
  customSpinner,
  getContributorContributionsVerificationResults,
  getSecondsMinutesHoursFromMillis,
  handleTimedoutMessageForContributor,
  makeContribution,
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
        ? `> Estimated waiting time ${theme.bold(
            `${convertToDoubleDigits(estHours)}:${convertToDoubleDigits(estMinutes)}:${convertToDoubleDigits(
              estSeconds
            )}`
          )}`
        : `> Cannot estimate time because no one has contributed yet`
    }`

    // Check if is the current contributor.
    if (newParticipantPositionInQueue === 1) {
      console.log(`\n${symbols.success} Your contribution is starting soon ${emojis.moon}`)
      unsubscriberForCircuitDocument()
    } else {
      console.log(
        `\n${symbols.info} Your position in queue is ${theme.bold(
          theme.magenta(newParticipantPositionInQueue - 1)
        )}\n${showTimeEstimation}`
      )
      console.log(`> Participant ${theme.bold(waitingQueue.currentContributor)} is currently contributing`)
    }
  })
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
      const { contributionProgress, status, contributionStep, contributions } = newParticipantData!
      const participantId = participantDoc.id

      // A. Do not have completed the contributions for each circuit; move to the next one.
      if (contributionProgress > 0 && contributionProgress <= circuits.length) {
        // Get updated circuits data.
        const circuits = await getCeremonyCircuits(ceremony.id)
        const circuit = circuits[contributionProgress - 1]
        const { waitingQueue } = circuit.data

        // A.1 If the participant is in `waiting` status, he/she must receive updates from the circuit's waiting queue.
        if (status === ParticipantStatus.WAITING) listenToCircuitChanges(participantId, circuit)

        // A.2 If the participant is in `contributing` status and is the current contributor, he/she must compute the contribution.
        if (
          status === ParticipantStatus.CONTRIBUTING &&
          waitingQueue.currentContributor === participantId &&
          contributionStep === ParticipantContributionStep.DOWNLOADING
        )
          // Compute the contribution.
          attestation = await makeContribution(
            ceremony,
            circuit,
            entropy,
            ghUsername,
            false,
            attestation,
            firebaseFunctions
          )

        // A.3 Current contributor timedout.
        if (status === ParticipantStatus.TIMEDOUT && contributionStep !== ParticipantContributionStep.COMPLETED) {
          await handleTimedoutMessageForContributor(
            newParticipantData!,
            participantDoc.id,
            ceremony.id,
            true,
            ghUsername
          )
        }
      }

      // B. Already contributed to each circuit.
      if (
        status === ParticipantStatus.CONTRIBUTED &&
        contributionProgress === numberOfCircuits + 1 &&
        contributions.length === numberOfCircuits
      ) {
        // Return true and false based on contribution verification.
        const contributionsValidity = await getContributorContributionsVerificationResults(
          ceremony.id,
          participantDoc.id,
          circuits
        )

        console.log(
          `\nCongrats, you have successfully contributed to ${theme.magenta(
            theme.bold(contributionsValidity.filter(Boolean).length)
          )} out of ${theme.magenta(theme.bold(numberOfCircuits))} circuits ${emojis.tada}`
        )

        const spinner = customSpinner("Uploading public attestation...", "clock")
        spinner.start()

        writeFile(`${paths.attestationPath}/${ceremony.data.prefix}_attestation.log`, Buffer.from(attestation))
        await sleep(1000)

        // TODO: If fails for permissions problems, ask to do manually.
        const gistUrl = await publishGist(ghToken, attestation, ceremony.data.prefix, ceremony.data.title)

        spinner.stop()
        console.log(
          `${symbols.success} Public attestation successfully published as Github Gist at this link ${theme.bold(
            theme.underlined(gistUrl)
          )}`
        )

        // Attestation link via Twitter.
        const attestationTweet = `https://twitter.com/intent/tweet?text=I%20contributed%20to%20the%20${ceremony.data.title}%20Phase%202%20Trusted%20Setup%20ceremony!%20You%20can%20contribute%20here:%20https://github.com/quadratic-funding/mpc-phase2-suite%20You%20can%20view%20my%20attestation%20here:%20${gistUrl}%20#Ethereum%20#ZKP`

        console.log(
          `\nWe appreciate your contribution to preserving the ${ceremony.data.title} security! ${
            emojis.key
          }  You can tweet about your participation if you'd like (click on the link below ${
            emojis.pointDown
          }) \n\n${theme.underlined(attestationTweet)}`
        )

        await open(attestationTweet)

        unsubscriberForParticipantDocument()
        terminate(ghUsername)
      }
    }
  )
}
