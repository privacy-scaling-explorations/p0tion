#!/usr/bin/env node

import { httpsCallable } from "firebase/functions"
import { handleAuthUserSignIn } from "../lib/auth.js"
import { theme, emojis, paths, collections, symbols } from "../lib/constants.js"
import { askForCeremonySelection } from "../lib/prompts.js"
import { ParticipantStatus } from "../../types/index.js"
import {
  bootstrapCommandExec,
  terminate,
  getEntropyOrBeacon,
  handleTimedoutMessageForContributor
} from "../lib/utils.js"
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
      `${symbols.warning} ${theme.bold(
        `The contribution process is based on a waiting queue mechanism (one contributor at a time) with an upper-bound time constraint per each contribution (does not restart if the process is halted for any reason). Any contribution could take the bulk of your computational resources and memory based on the size of the circuit`
      )} ${emojis.fire}\n`
    )

    // Ask to select a ceremony.
    const ceremony = await askForCeremonySelection(runningCeremoniesDocs)

    // Handle entropy request/generation.
    const entropy = await getEntropyOrBeacon(true)

    // Call Cloud Function for participant check and registration.
    const { data: canParticipate } = await checkAndRegisterParticipant({ ceremonyId: ceremony.id })

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

    // Check if the user can take part of the waiting queue for contributing.
    if (canParticipate) console.log(`\nYou are now joining the waiting queue ${emojis.clock}`)
    else await handleTimedoutMessageForContributor(participantData!, participantDoc.id, ceremony.id, false, ghUsername)

    // Check if already contributed.
    if (
      (!canParticipate && participantData?.status === ParticipantStatus.CONTRIBUTED) ||
      participantData?.status === ParticipantStatus.FINALIZED
    ) {
      console.log(
        `\nCongrats, you have already contributed to ${theme.magenta(
          theme.bold(participantData.contributionProgress - 1)
        )} out of ${theme.magenta(theme.bold(numberOfCircuits))} circuits ${
          emojis.tada
        }\nWe wanna thank you for your participation in preserving the security for ${theme.bold(
          ceremony.data.title
        )} Trusted Setup ceremony ${emojis.pray}`
      )

      terminate(ghUsername)
    }

    // Check for output directory.
    if (!directoryExists(paths.outputPath)) cleanDir(paths.outputPath)

    // Clean directories.
    cleanDir(paths.contributePath)
    cleanDir(paths.contributionsPath)
    cleanDir(paths.attestationPath)
    cleanDir(paths.contributionTranscriptsPath)

    // Listen to circuits and participant document changes.
    listenForContribution(participantDoc, ceremony, circuits, firebaseFunctions, ghToken, ghUsername, entropy)
  } catch (err: any) {
    showError(`Something went wrong: ${err.toString()}`, true)
  }
}

export default contribute
