#!/usr/bin/env node

import {
    checkParticipantForCeremony,
    getCeremonyCircuits,
    getContributorContributionsVerificationResults,
    getDocumentById,
    getOpenedCeremonies,
    checkAndMakeNewDirectoryIfNonexistent,
    commonTerms
} from "@zkmpc/actions"
import { askForCeremonySelection, getEntropyOrBeacon } from "../lib/prompts"
import { ParticipantContributionStep, ParticipantStatus } from "../../types/index"
import { terminate, handleTimedoutMessageForContributor, customSpinner, simpleLoader } from "../lib/utils"
import listenForContribution from "../lib/listeners"
import { FIREBASE_ERRORS, GENERIC_ERRORS, showError } from "../lib/errors"
import { bootstrapCommandExecutionAndServices } from "../lib/commands"
import { checkAuth } from "../lib/authorization"
import {
    attestationLocalFolderPath,
    contributeLocalFolderPath,
    contributionsLocalFolderPath,
    contributionTranscriptsLocalFolderPath,
    outputLocalFolderPath
} from "../lib/paths"
import theme from "../lib/theme"

/**
 * Contribute command.
 */
const contribute = async () => {
    try {
        // Initialize services.
        const { firebaseApp, firebaseFunctions, firestoreDatabase } = await bootstrapCommandExecutionAndServices()

        // Handle current authenticated user sign in.
        const { user, token, handle } = await checkAuth(firebaseApp)

        // Get running cerimonies info (if any).
        const runningCeremoniesDocs = await getOpenedCeremonies(firestoreDatabase)

        if (runningCeremoniesDocs.length === 0) showError(FIREBASE_ERRORS.FIREBASE_CEREMONY_NOT_OPENED, true)

        console.log(
            `${theme.symbols.warning} ${theme.text.bold(
                `The contribution process is based on a waiting queue mechanism (one contributor at a time) with an upper-bound time constraint per each contribution (does not restart if the process is halted for any reason).\n${theme.symbols.info} Any contribution could take the bulk of your computational resources and memory based on the size of the circuit`
            )} ${theme.emojis.fire}\n`
        )

        // Ask to select a ceremony.
        const ceremony = await askForCeremonySelection(runningCeremoniesDocs)

        // Get ceremony circuits.
        const circuits = await getCeremonyCircuits(firestoreDatabase, ceremony.id)
        const numberOfCircuits = circuits.length

        const spinner = customSpinner(`Checking eligibility...`, `clock`)
        spinner.start()

        // Call Cloud Function for participant check and registration.

        const canParticipate = await checkParticipantForCeremony(firebaseFunctions, ceremony.id)

        // Get participant document.
        const participantDoc = await getDocumentById(
            firestoreDatabase,
            `${commonTerms.collections.ceremonies.name}/${ceremony.id}/${commonTerms.collections.participants.name}`,
            user.uid
        )

        // Get updated data from snap.
        const participantData = participantDoc.data()

        if (!participantData) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

        // Check if the user can take part of the waiting queue for contributing.
        if (canParticipate) {
            spinner.succeed(`You are eligible to contribute to the ceremony ${theme.emojis.tada}\n`)

            // Check for output directory.
            checkAndMakeNewDirectoryIfNonexistent(outputLocalFolderPath)
            checkAndMakeNewDirectoryIfNonexistent(contributeLocalFolderPath)
            checkAndMakeNewDirectoryIfNonexistent(contributionsLocalFolderPath)
            checkAndMakeNewDirectoryIfNonexistent(attestationLocalFolderPath)
            checkAndMakeNewDirectoryIfNonexistent(contributionTranscriptsLocalFolderPath)

            // Check if entropy is needed.
            let entropy = ""

            if (
                (participantData?.contributionProgress === numberOfCircuits &&
                    participantData?.contributionStep < ParticipantContributionStep.UPLOADING) ||
                participantData?.contributionProgress < numberOfCircuits
            )
                entropy = await getEntropyOrBeacon(true)

            // Listen to circuits and participant document changes.
            await listenForContribution(
                participantDoc,
                ceremony,
                firestoreDatabase,
                circuits,
                firebaseFunctions,
                token,
                handle,
                entropy
            )
        } else {
            spinner.warn(`You are not eligible to contribute to the ceremony right now`)

            await handleTimedoutMessageForContributor(
                firestoreDatabase,
                participantData!,
                participantDoc.id,
                ceremony.id,
                false,
                handle
            )
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
                firestoreDatabase,
                ceremony.id,
                participantDoc.id,
                circuits,
                false
            )
            const numberOfValidContributions = contributionsValidity.filter(Boolean).length

            if (numberOfValidContributions) {
                console.log(
                    `Congrats, you have already contributed to ${theme.colors.magenta(
                        theme.text.bold(numberOfValidContributions)
                    )} out of ${theme.colors.magenta(theme.text.bold(numberOfCircuits))} circuits ${theme.emojis.tada}`
                )

                // Show valid/invalid contributions per each circuit.
                let idx = 0
                for (const contributionValidity of contributionsValidity) {
                    console.log(
                        `${contributionValidity ? theme.symbols.success : theme.symbols.error} ${theme.text.bold(
                            `Circuit`
                        )} ${theme.text.bold(theme.colors.magenta(idx + 1))}`
                    )
                    idx += 1
                }

                console.log(
                    `\nWe wanna thank you for your participation in preserving the security for ${theme.text.bold(
                        ceremony.data.title
                    )} Trusted Setup ceremony ${theme.emojis.pray}`
                )
            } else
                console.log(
                    `\nYou have not successfully contributed to any of the ${theme.text.bold(
                        theme.colors.magenta(circuits.length)
                    )} circuits ${theme.emojis.upsideDown}`
                )

            // Graceful exit.
            terminate(handle)
        }
    } catch (err: any) {
        showError(`Something went wrong: ${err.toString()}`, true)
    }
}

export default contribute
