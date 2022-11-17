#!/usr/bin/env node

import readline from "readline"
import logSymbols from "log-symbols"
import { getOpenedCeremonies, getCeremonyCircuits } from "@zkmpc/actions"
import { FirebaseDocumentInfo } from "../../types/index.js"
import { onlyCoordinator, handleCurrentAuthUserSignIn } from "../lib/auth.js"
import {
  bootstrapCommandExec,
  convertToDoubleDigits,
  customSpinner,
  getSecondsMinutesHoursFromMillis,
  sleep
} from "../lib/utils.js"
import { askForCeremonySelection } from "../lib/prompts.js"
import { getCurrentContributorContribution } from "../lib/queries.js"
import { GENERIC_ERRORS, showError } from "../lib/errors.js"
import { theme, emojis, symbols, observationWaitingTimeInMillis } from "../lib/constants.js"

/**
 * Clean cursor lines from current position back to root (default: zero).
 * @param currentCursorPos - the current position of the cursor.
 * @returns <number>
 */
const cleanCursorPosBackToRoot = (currentCursorPos: number) => {
  while (currentCursorPos < 0) {
    // Get back and clean line by line.
    readline.cursorTo(process.stdout, 0)
    readline.clearLine(process.stdout, 0)
    readline.moveCursor(process.stdout, -1, -1)

    currentCursorPos += 1
  }

  return currentCursorPos
}

/**
 * Show the latest updates for the given circuit.
 * @param ceremony <FirebaseDocumentInfo> - the Firebase document containing info about the ceremony.
 * @param circuit <FirebaseDocumentInfo> - the Firebase document containing info about the circuit.
 * @returns Promise<number> return the current position of the cursor (i.e., number of lines displayed).
 */
const displayLatestCircuitUpdates = async (
  ceremony: FirebaseDocumentInfo,
  circuit: FirebaseDocumentInfo
): Promise<number> => {
  let observation = theme.bold(`- Circuit # ${theme.magenta(circuit.data.sequencePosition)}`) // Observation output.
  let cursorPos = -1 // Current cursor position (nb. decrease every time there's a new line!).

  const { waitingQueue } = circuit.data

  // Get info from circuit.
  const { currentContributor } = waitingQueue
  const { completedContributions } = waitingQueue

  if (!currentContributor) {
    observation += `\n> Nobody's currently waiting to contribute ${emojis.eyes}`
    cursorPos -= 1
  } else {
    // Search for currentContributor' contribution.
    const contributions = await getCurrentContributorContribution(ceremony.id, circuit.id, currentContributor)

    if (!contributions.length) {
      // The contributor is currently contributing.
      observation += `\n> Participant ${theme.bold(`#${completedContributions + 1}`)} (${theme.bold(
        currentContributor
      )}) is currently contributing ${emojis.fire}`

      cursorPos -= 1
    } else {
      // The contributor has contributed.
      observation += `\n> Participant ${theme.bold(`#${completedContributions}`)} (${theme.bold(
        currentContributor
      )}) has completed the contribution ${emojis.tada}`

      cursorPos -= 1

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
      } = getSecondsMinutesHoursFromMillis(contributionData?.verificationTime)

      observation += `\n> The ${theme.bold("computation")} took ${theme.bold(
        `${convertToDoubleDigits(contributionTimeHours)}:${convertToDoubleDigits(
          contributionTimeMinutes
        )}:${convertToDoubleDigits(contributionTimeSeconds)}`
      )}`
      observation += `\n> The ${theme.bold("verification")} took ${theme.bold(
        `${convertToDoubleDigits(verificationTimeHours)}:${convertToDoubleDigits(
          verificationTimeMinutes
        )}:${convertToDoubleDigits(verificationTimeSeconds)}`
      )}`
      observation += `\n> Contribution ${
        contributionData?.valid
          ? `${theme.bold("VALID")} ${symbols.success}`
          : `${theme.bold("INVALID")} ${symbols.error}`
      }`

      cursorPos -= 3
    }
  }

  // Show observation for circuit.
  process.stdout.write(`${observation}\n\n`)
  cursorPos -= 1

  return cursorPos
}

/**
 * Observe command.
 */
const observe = async () => {
  try {
    // Initialize services.
    const { firebaseApp, firestoreDatabase } = await bootstrapCommandExec()

    // Handle current authenticated user sign in.
    const { user } = await handleCurrentAuthUserSignIn(firebaseApp)

    // Check custom claims for coordinator role.
    await onlyCoordinator(user)

    // Get running cerimonies info (if any).
    const runningCeremoniesDocs = await getOpenedCeremonies(firestoreDatabase)

    // Ask to select a ceremony.
    const ceremony = await askForCeremonySelection(runningCeremoniesDocs)

    console.log(`${logSymbols.info} Refresh rate set to ~3 seconds for waiting queue updates\n`)

    let cursorPos = 0 // Keep track of current cursor position.

    const spinner = customSpinner(`Getting ready...`, "clock")
    spinner.start()

    // Get circuit updates every 3 seconds.
    setInterval(async () => {
      // Clean cursor position back to root.
      cursorPos = cleanCursorPosBackToRoot(cursorPos)

      const spinner = customSpinner(`Updating...`, "clock")
      spinner.start()

      // Get updates from circuits.
      const circuits = await getCeremonyCircuits(firestoreDatabase, ceremony.id)

      await sleep(observationWaitingTimeInMillis / 10) // Just for a smoother UX/UI experience.

      spinner.stop()

      // Observe changes for each circuit
      for await (const circuit of circuits) cursorPos += await displayLatestCircuitUpdates(ceremony, circuit)

      process.stdout.write(`Press CTRL+C to exit`)

      await sleep(1000) // Just for a smoother UX/UI experience.
    }, observationWaitingTimeInMillis)

    await sleep(observationWaitingTimeInMillis) // Wait until the first update.

    spinner.stop()
  } catch (err: any) {
    showError(`Something went wrong: ${err.toString()}`, true)
  }
}

export default observe
