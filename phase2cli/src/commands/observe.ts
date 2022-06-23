#!/usr/bin/env node

import { DocumentSnapshot, onSnapshot } from "firebase/firestore"
import { emojis, symbols, theme } from "../lib/constants.js"
import { onlyCoordinator, handleAuthUserSignIn } from "../lib/auth.js"
import { bootstrapCommandExec, convertToDoubleDigits, getSecondsMinutesHoursFromMillis } from "../lib/utils.js"
import { askForCeremonySelection, askForCircuitSelectionFromFirebase } from "../lib/prompts.js"
import { getCeremonyCircuits, getCurrentContributorContribution, getOpenedCeremonies } from "../lib/queries.js"
import { GENERIC_ERRORS, showError } from "../lib/errors.js"

/**
 * Observe command.
 */
const observe = async () => {
  try {
    // Initialize services.
    await bootstrapCommandExec()

    // Handle authenticated user sign in.
    const { user } = await handleAuthUserSignIn()

    // Check custom claims for coordinator role.
    await onlyCoordinator(user)

    // Get running cerimonies info (if any).
    const runningCeremoniesDocs = await getOpenedCeremonies()

    // Ask to select a ceremony.
    const ceremony = await askForCeremonySelection(runningCeremoniesDocs)

    // Get ceremony circuits.
    const circuits = await getCeremonyCircuits(ceremony.id)

    // Ask to select a specific circuit.
    const circuit = await askForCircuitSelectionFromFirebase(circuits)

    console.log(theme.bold(`\n- Circuit # ${theme.magenta(`${circuit.data.sequencePosition}`)}`))

    // Observe a specific circuit.
    onSnapshot(circuit.ref, async (circuitDocSnap: DocumentSnapshot) => {
      // Get updated data from Firestore snapshot.
      const newCircuitData = circuitDocSnap.data()

      if (!newCircuitData) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

      const { waitingQueue } = newCircuitData!

      // Get info from circuit.
      const { currentContributor } = waitingQueue
      const { completedContributions } = waitingQueue

      if (!currentContributor) console.log(`\n> Nobody's currently waiting to contribute ${emojis.eyes}`)
      else {
        // Search for currentContributor' contribution.
        const contributions = await getCurrentContributorContribution(ceremony.id, circuit.id, currentContributor)

        if (!contributions.length)
          // The contributor is currently contributing.
          console.log(
            `\n> Participant # ${theme.magenta(completedContributions + 1)} (${theme.bold(
              currentContributor
            )}) is currently contributing ${emojis.fire}`
          )
        else {
          // The contributor has finished the contribution.
          const contributionData = contributions.at(0)?.data

          if (!contributionData) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

          // Convert times to seconds.
          const {
            seconds: contributionTimeSeconds,
            minutes: contributionTimeMinutes,
            hours: contributionTimeHours
          } = getSecondsMinutesHoursFromMillis(contributionData?.contributionTime)
          const {
            seconds: verificationTimeSeconds,
            minutes: verificationTimeMinutes,
            hours: verificationTimeHours
          } = getSecondsMinutesHoursFromMillis(contributionData?.contributionTime)

          console.log(
            `> The ${theme.bold("computation")} took ${theme.magenta(
              `${convertToDoubleDigits(contributionTimeHours)}:${convertToDoubleDigits(
                contributionTimeMinutes
              )}:${convertToDoubleDigits(contributionTimeSeconds)}`
            )}`
          )
          console.log(
            `> The ${theme.bold("verification")} took ${theme.magenta(
              `${convertToDoubleDigits(verificationTimeHours)}:${convertToDoubleDigits(
                verificationTimeMinutes
              )}:${convertToDoubleDigits(verificationTimeSeconds)}`
            )}`
          )
          console.log(
            `> Contribution ${
              contributionData?.valid
                ? `${theme.bold("okay")} ${symbols.success}`
                : `${theme.bold("not okay")} ${symbols.error}`
            }`
          )
        }
      }
    })
  } catch (err: any) {
    showError(`Something went wrong: ${err.toString()}`, true)
  }
}

export default observe
