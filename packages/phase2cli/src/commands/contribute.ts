#!/usr/bin/env node

import {
    getOpenedCeremonies,
    getCeremonyCircuits,
    checkParticipantForCeremony,
    getDocumentById,
    getParticipantsCollectionPath,
    getContributionsValidityForContributor,
    getNextCircuitForContribution,
    formatZkeyIndex,
    getCurrentActiveParticipantTimeout
} from "@zkmpc/actions/src"
import { DocumentSnapshot, DocumentData, Firestore, onSnapshot, Timestamp } from "firebase/firestore"
import { Functions } from "firebase/functions"
import { ContributionValidity, FirebaseDocumentInfo } from "@zkmpc/actions/src/types"
import { ParticipantStatus, ParticipantContributionStep } from "@zkmpc/actions/src/types/enums"
import { promptForCeremonySelection, promptForEntropy } from "../lib/prompts"
import {
    terminate,
    customSpinner,
    simpleLoader,
    convertToDoubleDigits,
    generatePublicAttestation,
    getSecondsMinutesHoursFromMillis,
    handleDiskSpaceRequirementForNextContribution,
    listenToCircuitChanges,
    makeContribution,
    sleep
} from "../lib/utils"
import { COMMAND_ERRORS, GENERIC_ERRORS, showError } from "../lib/errors"
import { bootstrapCommandExecutionAndServices, checkAuth } from "../lib/services"
import { localPaths } from "../lib/localConfigs"
import theme from "../lib/theme"
import { checkAndMakeNewDirectoryIfNonexistent } from "../lib/files"

/**
 * Display if a set of contributions computed for a circuit is valid/invalid.
 * @param contributionsWithValidity <Array<ContributionValidity>> - list of contributor contributions together with contribution validity.
 */
const displayContributionValidity = (contributionsWithValidity: Array<ContributionValidity>) => {
    // Circuit index position.
    let circuitSequencePosition = 1 // nb. incremental value is enough because the contributions are already sorted x circuit sequence position.

    for (const contributionWithValidity of contributionsWithValidity) {
        // Display.
        console.log(
            `${contributionWithValidity.valid ? theme.symbols.success : theme.symbols.error} ${theme.text.bold(
                `Circuit`
            )} ${theme.text.bold(theme.colors.magenta(circuitSequencePosition))}`
        )

        // Increment circuit position.
        circuitSequencePosition += 1
    }
}

/**
 * Display and manage data necessary when participant has already made the contribution for all circuits of a ceremony.
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @param circuits <Array<FirebaseDocumentInfo>> - the array of ceremony circuits documents.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param participantId <string> - the unique identifier of the contributor.
 */
const handleAlreadyContributedScenario = async (
    firestoreDatabase: Firestore,
    circuits: Array<FirebaseDocumentInfo>,
    ceremonyId: string,
    participantId: string
) => {
    // Get contributors' contributions validity.
    const contributionsWithValidity = await getContributionsValidityForContributor(
        firestoreDatabase,
        circuits,
        ceremonyId,
        participantId,
        false
    )

    // Filter only valid contributions.
    const validContributions = contributionsWithValidity.filter(
        (contributionWithValidity: ContributionValidity) => contributionWithValidity.valid
    )

    if (!validContributions.length)
        console.log(
            `\n${theme.symbols.error} You have provided ${theme.text.bold(
                theme.colors.magenta(circuits.length)
            )} out of ${theme.text.bold(theme.colors.magenta(circuits.length))} invalid contributions ${
                theme.emojis.upsideDown
            }`
        )
    else {
        console.log(
            `\nYou have provided ${theme.colors.magenta(
                theme.text.bold(validContributions.length)
            )} out of ${theme.colors.magenta(theme.text.bold(circuits.length))} valid contributions ${
                theme.emojis.tada
            }`
        )

        // Display (in)valid contributions per circuit.
        displayContributionValidity(contributionsWithValidity)

        console.log(`\nThank you for participating and securing the ceremony ${theme.emojis.pray}`)
    }
}

/**
 * Display and manage data necessary when participant would like to contribute but there is still an on-going timeout.
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param participantId <string> - the unique identifier of the contributor.
 * @param participantContributionProgress <number> - the progress in the contribution of the various circuits of the ceremony.
 * @param wasContributing <boolean> - flag to discriminate between participant currently contributing (true) or not (false).
 */
export const handleTimedoutMessageForContributor = async (
    firestoreDatabase: Firestore,
    participantId: string,
    ceremonyId: string,
    participantContributionProgress: number,
    wasContributing: boolean
) => {
    // Check if the participant was contributing when timeout happened.
    if (!wasContributing)
        console.log(theme.text.bold(`\n- Circuit # ${theme.colors.magenta(participantContributionProgress)}`))

    // Display timeout message.
    console.log(
        `\n${theme.symbols.error} ${
            wasContributing
                ? `Your contribution took longer than the estimated time and you were removed as current contributor. You should wait for a timeout to expire before you can rejoin for contribution.`
                : `The waiting time (timeout) to retry the contribution has not yet expired.`
        }\n\n${
            theme.symbols.warning
        } Note that the timeout could be triggered due to network latency, disk availability issues, un/intentional crashes, limited hardware capabilities.`
    )

    // nb. workaround to attend timeout to be written on the database.
    /// @todo use listeners instead (when possible).
    await simpleLoader(`Getting timeout expiration...`, `clock`, 5000)

    // Retrieve latest updated active timeouts for contributor.
    const activeTimeouts = await getCurrentActiveParticipantTimeout(firestoreDatabase, ceremonyId, participantId)

    if (activeTimeouts.length !== 1) showError(COMMAND_ERRORS.COMMAND_CONTRIBUTE_NO_UNIQUE_ACTIVE_TIMEOUTS, true)

    // Get active timeout.
    const activeTimeout = activeTimeouts.at(0)!

    if (!activeTimeout.data) showError(COMMAND_ERRORS.COMMAND_CONTRIBUTE_NO_ACTIVE_TIMEOUT_DATA, true)

    // Extract data.
    const { endDate } = activeTimeout.data!

    const { seconds, minutes, hours, days } = getSecondsMinutesHoursFromMillis(
        Number(endDate) - Timestamp.now().toMillis()
    )

    console.log(
        `${theme.symbols.info} Your timeout will end in ${theme.text.bold(
            `${convertToDoubleDigits(days)}:${convertToDoubleDigits(hours)}:${convertToDoubleDigits(
                minutes
            )}:${convertToDoubleDigits(seconds)}`
        )} (dd/hh/mm/ss)`
    )
}

// Listen to changes on the user-related participant document.
/// @todo needs refactoring.
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
                if (
                    !!contributionStep &&
                    status === ParticipantStatus.WAITING &&
                    oldStatus !== ParticipantStatus.TIMEDOUT
                ) {
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
                    await simpleLoader(
                        `Your contribution will ${
                            contributionStep === ParticipantContributionStep.DOWNLOADING ? `start` : `resume`
                        } soon ${theme.emojis.clock}`,
                        `clock`,
                        3000
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
                    const contributionsValidity = await getContributionsValidityForContributor(
                        firestoreDatabase,
                        updatedCircuits,
                        ceremony.id,
                        participantDoc.id,
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
                if (
                    status === ParticipantStatus.TIMEDOUT &&
                    contributionStep !== ParticipantContributionStep.COMPLETED
                ) {
                    await handleTimedoutMessageForContributor(
                        firestoreDatabase,
                        participantDoc.id,
                        ceremony.id,
                        contributionProgress,
                        true
                    )

                    terminate(ghUsername)
                }

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
 * @notice The contribute command allows an authenticated user to become a participant (contributor) to the selected ceremony by providing the
 * entropy (toxic waste) for the contribution.
 * @dev For proper execution, the command requires the user to be authenticated with Github account (run auth command first) in order to
 * handle sybil-resistance and connect to Github APIs to publish the gist containing the public attestation.
 */
const contribute = async () => {
    const { firebaseApp, firebaseFunctions, firestoreDatabase } = await bootstrapCommandExecutionAndServices()

    // Check for authentication.
    const { user, handle, token } = await checkAuth(firebaseApp)

    // Retrieve the opened ceremonies.
    const ceremoniesOpenedForContributions = await getOpenedCeremonies(firestoreDatabase)

    // Gracefully exit if no ceremonies are opened for contribution.
    if (!ceremoniesOpenedForContributions.length)
        showError(COMMAND_ERRORS.COMMAND_CONTRIBUTE_NO_OPENED_CEREMONIES, true)

    console.log(
        `${theme.symbols.warning} ${theme.text.bold(
            `The contribution process is based on a waiting queue mechanism (one contributor at a time per circuit) with an upper-bound time constraint per each contribution (if the process is halted for any reason, it doesn't restart).\n${theme.symbols.info} Any contribution could take the bulk of your computational resources and memory based on the size of the circuit`
        )} ${theme.emojis.fire}\n`
    )

    // Prompt the user to select a ceremony from the opened ones.
    const selectedCeremony = await promptForCeremonySelection(ceremoniesOpenedForContributions)

    // Get selected ceremony circuit(s) documents.
    const circuits = await getCeremonyCircuits(firestoreDatabase, selectedCeremony.id)

    const spinner = customSpinner(`Verifying your participant status...`, `clock`)
    spinner.start()

    // Check the user's current participant readiness for contribution status (eligible, already contributed, timed out).
    const canParticipantContributeToCeremony = await checkParticipantForCeremony(firebaseFunctions, selectedCeremony.id)

    await sleep(2000) // wait for CF execution.

    // Get updated participant data.
    const participant = await getDocumentById(
        firestoreDatabase,
        getParticipantsCollectionPath(selectedCeremony.id),
        user.uid
    )

    const participantData = participant.data()

    if (!participantData) showError(COMMAND_ERRORS.COMMAND_CONTRIBUTE_NO_PARTICIPANT_DATA, true)

    if (canParticipantContributeToCeremony) {
        spinner.succeed(`Great, you are qualified to contribute to the ceremony`)

        let entropy = "" // toxic waste.

        // Prepare local directories.
        checkAndMakeNewDirectoryIfNonexistent(localPaths.output)
        checkAndMakeNewDirectoryIfNonexistent(localPaths.contribute)
        checkAndMakeNewDirectoryIfNonexistent(localPaths.contributions)
        checkAndMakeNewDirectoryIfNonexistent(localPaths.attestations)
        checkAndMakeNewDirectoryIfNonexistent(localPaths.transcripts)

        // Extract participant data.
        const { contributionProgress, contributionStep } = participantData!

        // Check if the participant can input the entropy
        if (
            contributionProgress < circuits.length ||
            (contributionProgress === circuits.length && contributionStep < ParticipantContributionStep.UPLOADING)
        )
            /// @todo should we preserve entropy between different re-run of the command? (e.g., resume after timeout).
            // Prompt for entropy generation.
            entropy = await promptForEntropy()

        /// @todo need refactoring.
        // Listener to following the core contribution workflow.
        await listenForContribution(
            participant,
            selectedCeremony,
            firestoreDatabase,
            circuits,
            firebaseFunctions,
            token,
            handle,
            entropy
        )
    } else {
        // Extract participant data.
        const { status, contributionStep, contributionProgress } = participantData!

        // Check whether the participant has already contributed to all circuits.
        if (
            (!canParticipantContributeToCeremony && status === ParticipantStatus.DONE) ||
            status === ParticipantStatus.FINALIZED
        ) {
            spinner.info(`You have already made the contributions for the circuits in the ceremony`)

            await handleAlreadyContributedScenario(firestoreDatabase, circuits, selectedCeremony.id, participant.id)
        }

        // Check if there's a timeout still in effect for the participant.
        if (status === ParticipantStatus.TIMEDOUT && contributionStep !== ParticipantContributionStep.COMPLETED) {
            spinner.warn(`Oops, you are not allowed to continue your contribution due to current timeout`)

            await handleTimedoutMessageForContributor(
                firestoreDatabase,
                participant.id,
                selectedCeremony.id,
                contributionProgress,
                false
            )
        }

        // Exit gracefully.
        terminate(handle)
    }
}

export default contribute
