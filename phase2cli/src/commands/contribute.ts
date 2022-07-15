#!/usr/bin/env node

import { httpsCallable } from "firebase/functions"
import { handleAuthUserSignIn } from "../lib/auth.js"
import { theme, emojis, paths, collections } from "../lib/constants.js"
import { askForCeremonySelection } from "../lib/prompts.js"
import { ParticipantStatus } from "../../types/index.js"
import { bootstrapCommandExec, terminate, getEntropyOrBeacon } from "../lib/utils.js"
import { getDocumentById } from "../lib/firebase.js"
import { cleanDir, directoryExists } from "../lib/files.js"
import listenForContribution from "../lib/listeners.js"
import { getOpenedCeremonies, getCeremonyCircuits } from "../lib/queries.js"
import { GENERIC_ERRORS, showError } from "../lib/errors.js"

/**
 * Contribute command.
 */
const contribute = async () => {
  try {
    // Initialize services.
    const { firebaseFunctions } = await bootstrapCommandExec()
    const checkAndRegisterParticipant = httpsCallable(firebaseFunctions, "checkAndRegisterParticipant")

    // Handle authenticated user sign in.
    const { user, ghToken, ghUsername } = await handleAuthUserSignIn()

    // Get running cerimonies info (if any).
    const runningCeremoniesDocs = await getOpenedCeremonies()

    console.log(
      `This process could take the bulk of your computational resources and memory for quite a long time based on the size and number of circuits ${emojis.fire}\nYou will be able to contribute as soon as it is your turn and remember that you will have an estimated time to complete each contribution! If for any reason the process stops, you will have to start over with just the remaining time! ${emojis.clock}\n`
    )

    // Ask to select a ceremony.
    const ceremony = await askForCeremonySelection(runningCeremoniesDocs)

    // Call Cloud Function for participant check and registration.
    const { data: newlyParticipant } = await checkAndRegisterParticipant({ ceremonyId: ceremony.id })

    // Get participant document.
    const participantDoc = await getDocumentById(
      `${collections.ceremonies}/${ceremony.id}/${collections.participants}`,
      user.uid
    )

    // Get ceremony circuits.
    const circuits = await getCeremonyCircuits(ceremony.id)
    const numberOfCircuits = circuits.length

    // Get updated data from snap.
    const participantData = participantDoc.data()

    if (!participantData) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

    // Check if already contributed.
    if (!newlyParticipant && participantData?.status === ParticipantStatus.CONTRIBUTED) {
      console.log(
        `\nCongratulations @${theme.bold(ghUsername)}! ${emojis.tada} You have already contributed to ${theme.magenta(
          theme.bold(participantData.contributionProgress - 1)
        )} out of ${theme.magenta(theme.bold(numberOfCircuits))} circuits ${emojis.fire}`
      )

      terminate(ghUsername)
    }

    // TODO: to be checked in case of crash etc. (use newlyParticipant value).

    // Check for output directory.
    if (!directoryExists(paths.outputPath)) cleanDir(paths.outputPath)

    // Clean directories.
    cleanDir(paths.contributePath)
    cleanDir(paths.contributionsPath)
    cleanDir(paths.attestationPath)
    cleanDir(paths.contributionTranscriptsPath)

    // Handle entropy request/generation.
    const entropy = await getEntropyOrBeacon(true)

    // Listen to circuits and participant document changes.
    listenForContribution(participantDoc, ceremony, circuits, firebaseFunctions, ghToken, ghUsername, entropy)
  } catch (err: any) {
    showError(`Something went wrong: ${err.toString()}`, true)
  }
}

export default contribute
