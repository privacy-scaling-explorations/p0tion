import { DocumentData, DocumentSnapshot, onSnapshot } from "firebase/firestore"
import { Functions, httpsCallable } from "firebase/functions"
import { FirebaseDocumentInfo, ParticipantContributionStep, ParticipantStatus } from "../../types/index.js"
import { emojis, symbols, theme } from "./constants.js"
import { getCeremonyCircuits } from "./queries.js"
import {
  convertToDoubleDigits,
  generatePublicAttestation,
  getNextCircuitForContribution,
  getSecondsMinutesHoursFromMillis,
  handleDiskSpaceRequirementForNextContribution,
  handleTimedoutMessageForContributor,
  makeContribution,
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
    const { fullContribution, verifyCloudFunction } = avgTimings

    // Get updated position for contributor in the queue.
    const newParticipantPositionInQueue = getParticipantPositionInQueue(waitingQueue.contributors, participantId)

    let newEstimatedWaitingTime = 0

    // Show new time estimation.
    if (fullContribution > 0 && verifyCloudFunction > 0)
      newEstimatedWaitingTime = (fullContribution + verifyCloudFunction) * (newParticipantPositionInQueue - 1)

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
  participantDoc: DocumentSnapshot<DocumentData>,
  ceremony: FirebaseDocumentInfo,
  circuits: Array<FirebaseDocumentInfo>,
  firebaseFunctions: Functions,
  ghToken: string,
  ghUsername: string,
  entropy: string
) => {
  // Get number of circuits for the selected ceremony.
  const numberOfCircuits = circuits.length

  // Listen to participant document changes.
  const unsubscriberForParticipantDocument = onSnapshot(
    participantDoc.ref,
    async (participantDocSnap: DocumentSnapshot) => {
      // Get updated data from snap.
      const newParticipantData = participantDocSnap.data()
      const oldParticipantData = participantDoc.data()

      if (!newParticipantData || !oldParticipantData) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

      // Extract updated participant document data.
      const { contributionProgress, status, contributionStep, contributions, tempContributionData } =
        newParticipantData!
      const {
        contributionStep: oldContributionStep,
        tempContributionData: oldTempContributionData,
        contributionProgress: oldContributionProgress,
        contributions: oldContributions,
        status: oldStatus
      } = oldParticipantData!
      const participantId = participantDoc.id

      // 0. Whem joining for the first time the waiting queue.
      if (
        status === ParticipantStatus.WAITING &&
        !contributionStep &&
        !contributions.length &&
        contributionProgress === 0
      ) {
        // Get next circuit.
        const nextCircuit = getNextCircuitForContribution(circuits, contributionProgress + 1)

        // Check disk space requirements for participant.
        const makeProgressToNextContribution = httpsCallable(firebaseFunctions, "makeProgressToNextContribution")
        await handleDiskSpaceRequirementForNextContribution(makeProgressToNextContribution, nextCircuit, ceremony.id)
      }

      // A. Do not have completed the contributions for each circuit; move to the next one.
      if (contributionProgress > 0 && contributionProgress <= circuits.length) {
        // Get updated circuits data.
        const circuits = await getCeremonyCircuits(ceremony.id)
        const circuit = circuits[contributionProgress - 1]
        const { waitingQueue } = circuit.data

        // Check if the contribution step is valid for starting/resuming the contribution.
        const isStepValidForStartingOrResumingContribution =
          (contributionStep === ParticipantContributionStep.DOWNLOADING &&
            status === ParticipantStatus.CONTRIBUTING &&
            (!oldContributionStep ||
              oldContributionStep !== contributionStep ||
              (oldContributionStep === contributionStep &&
                status === oldStatus &&
                oldContributionProgress === contributionProgress))) ||
          (contributionStep === ParticipantContributionStep.COMPUTING &&
            oldContributionStep === contributionStep &&
            oldContributions.length === contributions.length) ||
          (contributionStep === ParticipantContributionStep.UPLOADING &&
            !oldTempContributionData &&
            !tempContributionData &&
            contributionStep === oldContributionStep) ||
          (!!oldTempContributionData &&
            !!tempContributionData &&
            JSON.stringify(Object.keys(oldTempContributionData).sort()) ===
              JSON.stringify(Object.keys(tempContributionData).sort()) &&
            JSON.stringify(Object.values(oldTempContributionData).sort()) ===
              JSON.stringify(Object.values(tempContributionData).sort()))

        // A.1 If the participant is in `waiting` status, he/she must receive updates from the circuit's waiting queue.
        if (status === ParticipantStatus.WAITING) listenToCircuitChanges(participantId, circuit)

        // A.2 If the participant is in `contributing` status and is the current contributor, he/she must compute the contribution.
        if (
          status === ParticipantStatus.CONTRIBUTING &&
          contributionStep !== ParticipantContributionStep.VERIFYING &&
          waitingQueue.currentContributor === participantId &&
          isStepValidForStartingOrResumingContribution
        )
          // Compute the contribution.
          await makeContribution(ceremony, circuit, entropy, ghUsername, false, firebaseFunctions, newParticipantData!)

        // A.3 Current contributor has already started the verification step.
        if (
          status === ParticipantStatus.CONTRIBUTING &&
          waitingQueue.currentContributor === participantId &&
          contributionStep === oldContributionStep &&
          contributionStep === ParticipantContributionStep.VERIFYING &&
          contributionProgress === oldContributionProgress
        ) {
          console.log(theme.bold(`\n- Circuit # ${theme.magenta(`${circuit.data.sequencePosition}`)}`))
          console.log(`${symbols.warning} The verification of your contribution has already started`)
        }

        // A.4 Server has terminated the already started verification step above.
        if (
          ((status === ParticipantStatus.DONE && oldStatus === ParticipantStatus.DONE) ||
            (status === ParticipantStatus.CONTRIBUTED && oldStatus === ParticipantStatus.CONTRIBUTED)) &&
          oldContributionProgress === contributionProgress - 1 &&
          contributionStep === ParticipantContributionStep.COMPLETED
        ) {
          console.log(
            `\n${symbols.success} Your contribution has been verified (results to be shown after last contribution)`
          )
        }

        // A.5 Current contributor timedout.
        if (status === ParticipantStatus.TIMEDOUT && contributionStep !== ParticipantContributionStep.COMPLETED) {
          await handleTimedoutMessageForContributor(
            newParticipantData!,
            participantDoc.id,
            ceremony.id,
            true,
            ghUsername
          )
        }

        // A.6 Contributor has finished the contribution and we need to check the memory before progressing.
        if (status === ParticipantStatus.CONTRIBUTED && contributionStep === ParticipantContributionStep.COMPLETED) {
          // Get next circuit for contribution.
          const nextCircuit = getNextCircuitForContribution(circuits, contributionProgress + 1)

          // Check disk space requirements for participant.
          const makeProgressToNextContribution = httpsCallable(firebaseFunctions, "makeProgressToNextContribution")
          const wannaGenerateAttestation = await handleDiskSpaceRequirementForNextContribution(
            makeProgressToNextContribution,
            nextCircuit,
            ceremony.id
          )

          if (wannaGenerateAttestation) {
            // Generate attestation with valid contributions.
            await generatePublicAttestation(ceremony, participantId, newParticipantData!, circuits, ghUsername, ghToken)

            unsubscriberForParticipantDocument()
            terminate(ghUsername)
          }
        }

        // B. Already contributed to each circuit.
        if (
          status === ParticipantStatus.DONE &&
          contributionStep === ParticipantContributionStep.COMPLETED &&
          contributionProgress === numberOfCircuits &&
          contributions.length === numberOfCircuits
        ) {
          await generatePublicAttestation(ceremony, participantId, newParticipantData!, circuits, ghUsername, ghToken)

          unsubscriberForParticipantDocument()
          terminate(ghUsername)
        }
      }
    }
  )
}
