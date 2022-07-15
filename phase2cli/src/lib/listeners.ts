import { DocumentSnapshot, onSnapshot } from "firebase/firestore"
import { Functions } from "firebase/functions"
import open from "open"
import { FirebaseDocumentInfo, ParticipantStatus } from "../../types/index.js"
import { emojis, paths, symbols, theme } from "./constants.js"
import { writeFile } from "./files.js"
import { getCeremonyCircuits } from "./queries.js"
import {
  convertToDoubleDigits,
  customSpinner,
  getSecondsMinutesHoursFromMillis,
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
          attestation = await makeContribution(
            ceremony,
            circuit,
            entropy,
            ghUsername,
            false,
            attestation,
            firebaseFunctions
          )
      }

      // B. Already contributed to each circuit.
      if (status === ParticipantStatus.CONTRIBUTED && contributionProgress === numberOfCircuits + 1) {
        // Check if participant has finished the contribution for each circuit.
        console.log(
          `\nCongratulations @${theme.bold(ghUsername)}! ${
            emojis.tada
          } You have correctly contributed to ${theme.magenta(
            theme.bold(contributionProgress - 1)
          )} out of ${theme.magenta(theme.bold(numberOfCircuits))} circuits!`
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
