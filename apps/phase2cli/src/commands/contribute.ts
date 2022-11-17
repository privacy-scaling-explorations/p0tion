#!/usr/bin/env node

import { httpsCallable } from "firebase/functions"
import { handleAuthUserSignIn } from "../lib/auth.js"
import { theme, emojis, collections, symbols, paths } from "../lib/constants.js"
import { askForCeremonySelection } from "../lib/prompts.js"
import { ParticipantContributionStep, ParticipantStatus } from "../../types/index.js"
import {
  bootstrapCommandExec,
  terminate,
  handleTimedoutMessageForContributor,
  getContributorContributionsVerificationResults,
  customSpinner,
  getEntropyOrBeacon,
  simpleLoader
} from "../lib/utils.js"
import { getDocumentById } from "../lib/firebase.js"
import listenForContribution from "../lib/listeners.js"
import { getOpenedCeremonies, getCeremonyCircuits } from "../lib/queries.js"
import { GENERIC_ERRORS, showError } from "../lib/errors.js"
import { checkAndMakeNewDirectoryIfNonexistent } from "../lib/files.js"

/**
 * Contribute command.
 */
const contribute = async () => {
  try {
    // Initialize services.
    const { firebaseApp, firebaseFunctions } = await bootstrapCommandExec()
    const checkParticipantForCeremony = httpsCallable(firebaseFunctions, "checkParticipantForCeremony")

    // Handle authenticated user sign in.
    const { user, ghToken, ghUsername } = await handleAuthUserSignIn(firebaseApp)

    // Get running cerimonies info (if any).
    const runningCeremoniesDocs = await getOpenedCeremonies()

    console.log(
      `${symbols.warning} ${theme.bold(
        `The contribution process is based on a waiting queue mechanism (one contributor at a time) with an upper-bound time constraint per each contribution (does not restart if the process is halted for any reason).\n${symbols.info} Any contribution could take the bulk of your computational resources and memory based on the size of the circuit`
      )} ${emojis.fire}\n`
    )

    // Ask to select a ceremony.
    const ceremony = await askForCeremonySelection(runningCeremoniesDocs)

    // Get ceremony circuits.
    const circuits = await getCeremonyCircuits(ceremony.id)
    const numberOfCircuits = circuits.length

    const spinner = customSpinner(`Checking eligibility...`, `clock`)
    spinner.start()

    // Call Cloud Function for participant check and registration.
    const { data: canParticipate } = await checkParticipantForCeremony({ ceremonyId: ceremony.id })

    // Get participant document.
    const participantDoc = await getDocumentById(
      `${collections.ceremonies}/${ceremony.id}/${collections.participants}`,
      user.uid
    )

    // Get updated data from snap.
    const participantData = participantDoc.data()

    if (!participantData) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

    // Check if the user can take part of the waiting queue for contributing.
    if (canParticipate) {
      spinner.succeed(`You are eligible to contribute to the ceremony ${emojis.tada}\n`)

      // Check for output directory.
      checkAndMakeNewDirectoryIfNonexistent(paths.outputPath)
      checkAndMakeNewDirectoryIfNonexistent(paths.contributePath)
      checkAndMakeNewDirectoryIfNonexistent(paths.contributionsPath)
      checkAndMakeNewDirectoryIfNonexistent(paths.attestationPath)
      checkAndMakeNewDirectoryIfNonexistent(paths.contributionTranscriptsPath)

      // Check if entropy is needed.
      let entropy = ""

      if (
        (participantData?.contributionProgress === numberOfCircuits &&
          participantData?.contributionStep < ParticipantContributionStep.UPLOADING) ||
        participantData?.contributionProgress < numberOfCircuits
      )
        entropy = await getEntropyOrBeacon(true)

      // Listen to circuits and participant document changes.
      await listenForContribution(participantDoc, ceremony, circuits, firebaseFunctions, ghToken, ghUsername, entropy)
    } else {
      spinner.warn(`You are not eligible to contribute to the ceremony right now`)

      await handleTimedoutMessageForContributor(participantData!, participantDoc.id, ceremony.id, false, ghUsername)
    }

    // Check if already contributed.
    if (
      ((!canParticipate && participantData?.status === ParticipantStatus.DONE) ||
        participantData?.status === ParticipantStatus.FINALIZED) &&
      participantData?.contributions.length > 0
    ) {
      spinner.fail(`You are not eligible to contribute to the ceremony\n`)

      await simpleLoader(`Checking for contributions...`, `clock`, 1500)

      // Return true and false based on contribution verification.
      const contributionsValidity = await getContributorContributionsVerificationResults(
        ceremony.id,
        participantDoc.id,
        circuits,
        false
      )
      const numberOfValidContributions = contributionsValidity.filter(Boolean).length

      if (numberOfValidContributions) {
        console.log(
          `Congrats, you have already contributed to ${theme.magenta(
            theme.bold(numberOfValidContributions)
          )} out of ${theme.magenta(theme.bold(numberOfCircuits))} circuits ${emojis.tada}`
        )

        // Show valid/invalid contributions per each circuit.
        let idx = 0
        for (const contributionValidity of contributionsValidity) {
          console.log(
            `${contributionValidity ? symbols.success : symbols.error} ${theme.bold(`Circuit`)} ${theme.bold(
              theme.magenta(idx + 1)
            )}`
          )
          idx += 1
        }

        console.log(
          `\nWe wanna thank you for your participation in preserving the security for ${theme.bold(
            ceremony.data.title
          )} Trusted Setup ceremony ${emojis.pray}`
        )
      } else
        console.log(
          `\nYou have not successfully contributed to any of the ${theme.bold(
            theme.magenta(circuits.length)
          )} circuits ${emojis.upsideDown}`
        )

      // Graceful exit.
      terminate(ghUsername)
    }
  } catch (err: any) {
    showError(`Something went wrong: ${err.toString()}`, true)
  }
}

export default contribute
