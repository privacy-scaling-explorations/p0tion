#!/usr/bin/env node

import {
    getOpenedCeremonies,
    getCeremonyCircuits,
    checkParticipantForCeremony,
    getDocumentById,
    getParticipantsCollectionPath,
    getContributorContributionsVerificationResults,
    getNextCircuitForContribution,
    formatZkeyIndex
} from "@zkmpc/actions/src"
import { DocumentSnapshot, DocumentData, Firestore, onSnapshot } from "firebase/firestore"
import { Functions } from "firebase/functions"
import { FirebaseDocumentInfo } from "@zkmpc/actions/src/types"
import { ParticipantStatus, ParticipantContributionStep } from "@zkmpc/actions/src/types/enums"
import { askForCeremonySelection, getEntropyOrBeacon } from "../lib/prompts"
import {
    terminate,
    handleTimedoutMessageForContributor,
    customSpinner,
    simpleLoader,
    convertToDoubleDigits,
    generatePublicAttestation,
    getSecondsMinutesHoursFromMillis,
    handleDiskSpaceRequirementForNextContribution,
    listenToCircuitChanges,
    makeContribution
} from "../lib/utils"
import { FIREBASE_ERRORS, GENERIC_ERRORS, showError } from "../lib/errors"
import { bootstrapCommandExecutionAndServices, checkAuth } from "../lib/services"
import { localPaths } from "../lib/localConfigs"
import theme from "../lib/theme"
import { checkAndMakeNewDirectoryIfNonexistent } from "../lib/files"

// Listen to changes on the user-related participant document.
const listenForContribution = async (
    participantDoc: DocumentSnapshot<DocumentData>,
    ceremony: FirebaseDocumentInfo,
    firestoreDatabase: Firestore,
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

            if (!newParticipantData || !oldParticipantData)
                showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

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
                await handleDiskSpaceRequirementForNextContribution(firebaseFunctions, nextCircuit, ceremony.id)
            }

            // A. Do not have completed the contributions for each circuit; move to the next one.
            if (contributionProgress > 0 && contributionProgress <= circuits.length) {
                // Get updated circuits data.
                const updatedCircuits = await getCeremonyCircuits(firestoreDatabase, ceremony.id)
                const circuit = updatedCircuits[contributionProgress - 1]
                const { waitingQueue } = circuit.data

                // Check if the contribution step is valid for starting/resuming the contribution.
                const isStepValidForStartingOrResumingContribution =
                    (contributionStep === ParticipantContributionStep.DOWNLOADING &&
                        status === ParticipantStatus.CONTRIBUTING &&
                        (!oldContributionStep ||
                            oldContributionStep !== contributionStep ||
                            (oldContributionStep === contributionStep &&
                                status === oldStatus &&
                                oldContributionProgress === contributionProgress) ||
                            oldStatus === ParticipantStatus.EXHUMED)) ||
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
                if (status === ParticipantStatus.WAITING && oldStatus !== ParticipantStatus.TIMEDOUT) {
                    console.log(
                        `${theme.text.bold(
                            `\n- Circuit # ${theme.colors.magenta(`${circuit.data.sequencePosition}`)}`
                        )} (Waiting Queue)`
                    )

                    listenToCircuitChanges(firestoreDatabase, participantId, ceremony.id, circuit)
                }
                // A.2 If the participant is in `contributing` status and is the current contributor, he/she must compute the contribution.
                if (
                    status === ParticipantStatus.CONTRIBUTING &&
                    contributionStep !== ParticipantContributionStep.VERIFYING &&
                    waitingQueue.currentContributor === participantId &&
                    isStepValidForStartingOrResumingContribution
                ) {
                    console.log(
                        `\n${theme.symbols.success} Your contribution will ${
                            contributionStep === ParticipantContributionStep.DOWNLOADING ? `start` : `resume`
                        } soon ${theme.emojis.clock}`
                    )

                    // Compute the contribution.
                    await makeContribution(
                        ceremony,
                        circuit,
                        entropy,
                        ghUsername,
                        false,
                        firebaseFunctions,
                        newParticipantData!
                    )
                }

                // A.3 Current contributor has already started the verification step.
                if (
                    status === ParticipantStatus.CONTRIBUTING &&
                    waitingQueue.currentContributor === participantId &&
                    contributionStep === oldContributionStep &&
                    contributionStep === ParticipantContributionStep.VERIFYING &&
                    contributionProgress === oldContributionProgress
                ) {
                    const spinner = customSpinner(`Resuming your contribution...`, `clock`)
                    spinner.start()

                    // Get current and next index.
                    const currentZkeyIndex = formatZkeyIndex(contributionProgress)
                    const nextZkeyIndex = formatZkeyIndex(contributionProgress + 1)

                    // Calculate remaining est. time for verification.
                    const avgVerifyCloudFunctionTime = circuit.data.avgTimings.verifyCloudFunction
                    const verificationStartedAt = newParticipantData?.verificationStartedAt
                    const estRemainingTimeInMillis = avgVerifyCloudFunctionTime - (Date.now() - verificationStartedAt)
                    const { seconds, minutes, hours } = getSecondsMinutesHoursFromMillis(estRemainingTimeInMillis)

                    spinner.succeed(`Your contribution will resume soon ${theme.emojis.clock}`)

                    console.log(
                        `${theme.text.bold(
                            `\n- Circuit # ${theme.colors.magenta(`${circuit.data.sequencePosition}`)}`
                        )} (Contribution Steps)`
                    )
                    console.log(
                        `${theme.symbols.success} Contribution ${theme.text.bold(
                            `#${currentZkeyIndex}`
                        )} already downloaded`
                    )
                    console.log(
                        `${theme.symbols.success} Contribution ${theme.text.bold(`#${nextZkeyIndex}`)} already computed`
                    )
                    console.log(
                        `${theme.symbols.success} Contribution ${theme.text.bold(
                            `#${nextZkeyIndex}`
                        )} already saved on storage`
                    )
                    console.log(
                        `${theme.symbols.info} Contribution verification already started (est. time ${theme.text.bold(
                            `${convertToDoubleDigits(hours)}:${convertToDoubleDigits(minutes)}:${convertToDoubleDigits(
                                seconds
                            )}`
                        )})`
                    )
                }

                // A.4 Server has terminated the already started verification step above.
                if (
                    ((status === ParticipantStatus.DONE && oldStatus === ParticipantStatus.DONE) ||
                        (status === ParticipantStatus.CONTRIBUTED && oldStatus === ParticipantStatus.CONTRIBUTED)) &&
                    oldContributionProgress === contributionProgress - 1 &&
                    contributionStep === ParticipantContributionStep.COMPLETED
                ) {
                    console.log(`\n${theme.symbols.success} Contribute verification has been completed`)

                    // Return true and false based on contribution verification.
                    const contributionsValidity = await getContributorContributionsVerificationResults(
                        firestoreDatabase,
                        ceremony.id,
                        participantDoc.id,
                        updatedCircuits,
                        false
                    )

                    // Check last contribution validity.
                    const isContributionValid = contributionsValidity[oldContributionProgress - 1]

                    console.log(
                        `${isContributionValid ? theme.symbols.success : theme.symbols.error} Your contribution ${
                            isContributionValid ? `is ${theme.text.bold("VALID")}` : `is ${theme.text.bold("INVALID")}`
                        }`
                    )
                }

                // A.5 Current contributor timedout.
                if (status === ParticipantStatus.TIMEDOUT && contributionStep !== ParticipantContributionStep.COMPLETED)
                    await handleTimedoutMessageForContributor(
                        firestoreDatabase,
                        newParticipantData!,
                        participantDoc.id,
                        ceremony.id,
                        true,
                        ghUsername
                    )

                // A.6 Contributor has finished the contribution and we need to check the memory before progressing.
                if (
                    status === ParticipantStatus.CONTRIBUTED &&
                    contributionStep === ParticipantContributionStep.COMPLETED
                ) {
                    // Get next circuit for contribution.
                    const nextCircuit = getNextCircuitForContribution(updatedCircuits, contributionProgress + 1)

                    // Check disk space requirements for participant.
                    const wannaGenerateAttestation = await handleDiskSpaceRequirementForNextContribution(
                        firebaseFunctions,
                        nextCircuit,
                        ceremony.id
                    )

                    if (wannaGenerateAttestation) {
                        // Generate attestation with valid contributions.
                        await generatePublicAttestation(
                            firestoreDatabase,
                            ceremony,
                            participantId,
                            newParticipantData!,
                            updatedCircuits,
                            ghUsername,
                            ghToken
                        )

                        unsubscriberForParticipantDocument()
                        terminate(ghUsername)
                    }
                }

                // A.7 If the participant is in `EXHUMED` status can be only after a timeout expiration.
                if (status === ParticipantStatus.EXHUMED) {
                    // Check disk space requirements for participant before resuming the contribution.
                    await handleDiskSpaceRequirementForNextContribution(
                        firebaseFunctions,
                        circuit,
                        ceremony.id,
                        "resumeContributionAfterTimeoutExpiration"
                    )
                }

                // B. Already contributed to each circuit.
                if (
                    status === ParticipantStatus.DONE &&
                    contributionStep === ParticipantContributionStep.COMPLETED &&
                    contributionProgress === numberOfCircuits &&
                    contributions.length === numberOfCircuits
                ) {
                    await generatePublicAttestation(
                        firestoreDatabase,
                        ceremony,
                        participantId,
                        newParticipantData!,
                        updatedCircuits,
                        ghUsername,
                        ghToken
                    )

                    unsubscriberForParticipantDocument()
                    terminate(ghUsername)
                }
            }
        }
    )
}

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
            getParticipantsCollectionPath(ceremony.id),
            user.uid
        )

        // Get updated data from snap.
        const participantData = participantDoc.data()

        if (!participantData) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

        // Check if the user can take part of the waiting queue for contributing.
        if (canParticipate) {
            spinner.succeed(`You are eligible to contribute to the ceremony ${theme.emojis.tada}\n`)

            // Check for output directory.
            checkAndMakeNewDirectoryIfNonexistent(localPaths.output)
            checkAndMakeNewDirectoryIfNonexistent(localPaths.contribute)
            checkAndMakeNewDirectoryIfNonexistent(localPaths.contributions)
            checkAndMakeNewDirectoryIfNonexistent(localPaths.attestations)
            checkAndMakeNewDirectoryIfNonexistent(localPaths.transcripts)

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
