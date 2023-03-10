#!/usr/bin/env node

import {
    getOpenedCeremonies,
    getCeremonyCircuits,
    checkParticipantForCeremony,
    getDocumentById,
    getParticipantsCollectionPath,
    getContributionsValidityForContributor,
    formatZkeyIndex,
    getCurrentActiveParticipantTimeout,
    getCircuitBySequencePosition,
    convertBytesOrKbToGb,
    resumeContributionAfterTimeoutExpiration,
    progressToNextCircuitForContribution,
    getCircuitContributionsFromContributor,
    generateValidContributionsAttestation,
    commonTerms
} from "@zkmpc/actions/src"
import { DocumentSnapshot, DocumentData, Firestore, onSnapshot, Timestamp } from "firebase/firestore"
import { Functions } from "firebase/functions"
import { Contribution, ContributionValidity, FirebaseDocumentInfo } from "@zkmpc/actions/src/types"
import { ParticipantStatus, ParticipantContributionStep } from "@zkmpc/actions/src/types/enums"
import open from "open"
import { askForConfirmation, promptForCeremonySelection, promptForEntropy } from "../lib/prompts"
import {
    terminate,
    customSpinner,
    simpleLoader,
    convertToDoubleDigits,
    getSecondsMinutesHoursFromMillis,
    sleep,
    getParticipantFreeRootDiskSpace,
    publishGist,
    generateCustomUrlToTweetAboutParticipation,
    handleStartOrResumeContribution,
    getPublicAttestationGist
} from "../lib/utils"
import { COMMAND_ERRORS, showError } from "../lib/errors"
import { bootstrapCommandExecutionAndServices, checkAuth } from "../lib/services"
import { getAttestationLocalFilePath, localPaths } from "../lib/localConfigs"
import theme from "../lib/theme"
import { checkAndMakeNewDirectoryIfNonexistent, writeFile } from "../lib/files"

/**
 * Generate a ready-to-share tweet on public attestation.
 * @param ceremonyTitle <string> - the title of the ceremony.
 * @param gistUrl <string> - the Github public attestation gist url.
 */
const handleTweetGeneration = async (ceremonyTitle: string, gistUrl: string): Promise<void> => {
    // Generate a ready to share custom url to tweet about ceremony participation.
    const tweetUrl = generateCustomUrlToTweetAboutParticipation(ceremonyTitle, gistUrl, false)

    console.log(
        `${
            theme.symbols.info
        } We encourage you to tweet to spread the word about your participation to the ceremony by clicking the link below\n\n${theme.text.underlined(
            tweetUrl
        )}`
    )

    // Automatically open a webpage with the tweet.
    await open(tweetUrl)
}

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
const handleContributionValidity = async (
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
const handleTimedoutMessageForContributor = async (
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

/**
 * Check if the participant has enough disk space available before joining the waiting queue
 * for the computing the next circuit contribution.
 * @param cloudFunctions <Functions> - the instance of the Firebase cloud functions for the application.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param circuitSequencePosition <number> - the position of the circuit in the sequence for contribution.
 * @param circuitZkeySizeInBytes <number> - the size in bytes of the circuit zKey.
 * @param isResumingAfterTimeout <boolean> - flag to discriminate between resuming after a timeout expiration (true) or progressing to next contribution (false).
 * @return <Promise<boolean>> - true when the contributor would like to generate the attestation and do not provide any further contribution to the ceremony; otherwise false.
 */
const handleDiskSpaceRequirementForNextContribution = async (
    cloudFunctions: Functions,
    ceremonyId: string,
    circuitSequencePosition: number,
    circuitZkeySizeInBytes: number,
    isResumingAfterTimeout: boolean
): Promise<boolean> => {
    // Custom spinner.
    const spinner = customSpinner(`Checking disk space requirement for next contribution...`, `clock`)
    spinner.start()

    // Compute disk space requirement to support circuit contribution (zKey size * 2).
    const contributionDiskSpaceRequirement = convertBytesOrKbToGb(circuitZkeySizeInBytes * 2, true)
    // Get participant available disk space.
    const participantFreeDiskSpace = convertBytesOrKbToGb(getParticipantFreeRootDiskSpace(), false)

    // Check disk space requirement to support circuit contribution.
    if (participantFreeDiskSpace < contributionDiskSpaceRequirement) {
        spinner.fail(
            `${
                theme.symbols.error
            } You do not have enough memory to compute the contribution for Circuit ${theme.colors.magenta(
                `${circuitSequencePosition}`
            )}.\nThe required amount of disk space is ${
                contributionDiskSpaceRequirement < 0.01
                    ? theme.text.bold(`< 0.01`)
                    : theme.text.bold(contributionDiskSpaceRequirement)
            } GB but you only have ${
                participantFreeDiskSpace > 0 ? theme.text.bold(participantFreeDiskSpace.toFixed(2)) : theme.text.bold(0)
            } GB free\n`
        )

        // Check if the requirement should be satisfied for a circuit different from first one.
        if (circuitSequencePosition > 1) {
            // There, the user could potentially decide to free up some memory to complete the contribution or
            // end up with contributions at all by generating the transcript.

            console.log(
                `${theme.symbols.info} Please note, you have time until ceremony ends to free up your memory and complete remaining contributions`
            )

            // Asks the contributor if their wants to terminate contributions for the ceremony.
            const { confirmation } = await askForConfirmation(
                `Please note, this action is irreversible! Do you want to end your contributions for the ceremony?`
            )

            return !!confirmation
        }
    } else {
        // Memory requirement for next contribution met.
        if (!isResumingAfterTimeout)
            // Progress the participant to the next circuit making it ready for contribution.
            await progressToNextCircuitForContribution(cloudFunctions, ceremonyId)
        // Resume contribution after timeout expiration (same circuit).
        else await resumeContributionAfterTimeoutExpiration(cloudFunctions, ceremonyId)

        spinner.succeed(
            `Memory requirement to contribute to Circuit ${theme.colors.magenta(
                `${circuitSequencePosition}`
            )} satisfied`
        )

        return false
    }

    return false
}

/**
 * Generate the public attestation for the contributor.
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @param circuits <Array<FirebaseDocumentInfo>> - the array of ceremony circuits documents.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param participantId <string> - the unique identifier of the contributor.
 * @param participantContributions <Array<Co> - the document data of the participant.
 * @param contributorIdentifier <string> - the identifier of the contributor (handle, name, uid).
 * @param ceremonyName <string> - the name of the ceremony.
 * @returns <Promise<string>> - the public attestation.
 */
const generatePublicAttestation = async (
    firestoreDatabase: Firestore,
    circuits: Array<FirebaseDocumentInfo>,
    ceremonyId: string,
    participantId: string,
    participantContributions: Array<Contribution>,
    contributorIdentifier: string,
    ceremonyName: string
): Promise<string> => {
    // Display contribution validity.
    await handleContributionValidity(firestoreDatabase, circuits, ceremonyId, participantId)

    // Get only valid contribution hashes.
    return generateValidContributionsAttestation(
        firestoreDatabase,
        circuits,
        ceremonyId,
        participantId,
        participantContributions,
        contributorIdentifier,
        ceremonyName,
        false
    )
}

/**
 * Generate a public attestation for a contributor, publish the attestation as gist, and prepare a new ready-to-share tweet about ceremony participation.
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @param circuits <Array<FirebaseDocumentInfo>> - the array of ceremony circuits documents.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param participantId <string> - the unique identifier of the contributor.
 * @param participantContributions <Array<Co> - the document data of the participant.
 * @param contributorIdentifier <string> - the identifier of the contributor (handle, name, uid).
 * @param ceremonyName <string> - the name of the ceremony.
 * @param ceremonyPrefix <string> - the prefix of the ceremony.
 * @param participantAccessToken <string> - the access token of the participant.
 */
const handlePublicAttestation = async (
    firestoreDatabase: Firestore,
    circuits: Array<FirebaseDocumentInfo>,
    ceremonyId: string,
    participantId: string,
    participantContributions: Array<Contribution>,
    contributorIdentifier: string,
    ceremonyName: string,
    ceremonyPrefix: string,
    participantAccessToken: string
) => {
    await simpleLoader(`Generating your public attestation...`, `clock`, 3000)

    // Generate attestation with valid contributions.
    const publicAttestation = await generatePublicAttestation(
        firestoreDatabase,
        circuits,
        ceremonyId,
        participantId,
        participantContributions,
        contributorIdentifier,
        ceremonyName
    )

    // Write public attestation locally.
    writeFile(
        getAttestationLocalFilePath(`${ceremonyPrefix}_${commonTerms.foldersAndPathsTerms.attestation}.log`),
        Buffer.from(publicAttestation)
    )

    await sleep(1000) // workaround for file descriptor unexpected close.

    /// @todo mandatory 'gist' permissions or not?.
    const gistUrl = await publishGist(participantAccessToken, publicAttestation, ceremonyName, ceremonyPrefix)

    console.log(
        `\n${theme.symbols.info} Your public attestation has been successfully posted as Github Gist (${theme.text.bold(
            theme.text.underlined(gistUrl)
        )})`
    )

    // Prepare a ready-to-share tweet.
    await handleTweetGeneration(ceremonyName, gistUrl)
}

/**
 * Listen to circuit current contributor document changes.
 * @notice the circuit is the one where a current contributor different than the listener participant is contributing.
 * @dev this listener use another listener for the current circuit contributor in order to inform the waiting participant about the current contributor's progress.
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param circuitId <string> - the unique identifier of the circuit.
 * @param circuitCurrentContributor <DocumentSnapshot<DocumentData>> - the Firestore document of the current circuit contributor.
 * @param completedContributions <number> - the amount of completed and valid circuit contributions so far.
 */
const listenToCircuitCurrentContributorDocumentChanges = async (
    firestoreDatabase: Firestore,
    ceremonyId: string,
    circuitId: string,
    circuitCurrentContributor: DocumentSnapshot<DocumentData>,
    completedContributions: number
): Promise<void> => {
    // Display info about the circuit current contributor.
    console.log(` - Contributor # ${theme.text.bold(theme.colors.magenta(completedContributions + 1))}`)

    // Compute data about the current contribution.
    const currentZkeyIndex = formatZkeyIndex(completedContributions)
    const nextZkeyIndex = formatZkeyIndex(completedContributions + 1)

    const unsubscriberToCircuitCurrentContributorDocument = onSnapshot(
        circuitCurrentContributor.ref,
        async (changedCircuitCurrentContributor: DocumentSnapshot) => {
            // Check data.
            if (!changedCircuitCurrentContributor.data())
                showError(COMMAND_ERRORS.COMMAND_CONTRIBUTE_NO_CURRENT_CONTRIBUTOR_DATA, true)

            // Extract data.
            const { contributionStep, status } = changedCircuitCurrentContributor.data()!

            // Check if current contributor has been timedout.
            if (status === ParticipantStatus.TIMEDOUT) {
                process.stdout.write(
                    `   ${theme.symbols.warning} A timeout has been triggered for the current contributor! The contribution must be computed by next contributor.`
                )

                // Unsubscribe.
                unsubscriberToCircuitCurrentContributorDocument()
            } else {
                // Inform the participant w/ different contribution steps progress while waiting for contribution.
                // nb. leave blank space for formatting purposes.
                switch (contributionStep) {
                    case ParticipantContributionStep.DOWNLOADING: {
                        console.log(
                            `   ${theme.symbols.info} Downloading contribution ${theme.text.bold(
                                `#${currentZkeyIndex}`
                            )}`
                        )

                        break
                    }
                    case ParticipantContributionStep.COMPUTING: {
                        process.stdout.write(
                            `   ${theme.symbols.success} Contribution ${theme.text.bold(
                                `#${currentZkeyIndex}`
                            )} downloaded correctly\n`
                        )

                        console.log(
                            `   ${theme.symbols.info} Computing contribution ${theme.text.bold(`#${nextZkeyIndex}`)}`
                        )

                        break
                    }
                    case ParticipantContributionStep.UPLOADING: {
                        process.stdout.write(
                            `   ${theme.symbols.success} Contribution ${theme.text.bold(
                                `#${nextZkeyIndex}`
                            )} computed correctly\n`
                        )

                        console.log(
                            `   ${theme.symbols.info} Uploading contribution ${theme.text.bold(`#${nextZkeyIndex}`)}`
                        )

                        break
                    }
                    case ParticipantContributionStep.VERIFYING: {
                        process.stdout.write(
                            `   ${theme.symbols.success} Contribution ${theme.text.bold(
                                `#${nextZkeyIndex}`
                            )} uploaded successfully\n`
                        )

                        console.log(
                            `   ${theme.symbols.info} Contribution verification ${theme.text.bold(`#${nextZkeyIndex}`)}`
                        )

                        break
                    }
                    case ParticipantContributionStep.COMPLETED: {
                        process.stdout.write(
                            `   ${theme.symbols.success} Contribution ${theme.text.bold(
                                `#${nextZkeyIndex}`
                            )} has been verified\n`
                        )

                        // Simple loader (+ workaround for verification info).
                        await simpleLoader(`Retrieving contribution verification info...`, `clock`, 5000)

                        // Get current circuit contribution from current contributor to check for validity.
                        const currentContributorContributions = await getCircuitContributionsFromContributor(
                            firestoreDatabase,
                            ceremonyId,
                            circuitId,
                            circuitCurrentContributor.id
                        )

                        // Check retrieved data.
                        if (currentContributorContributions.length !== 1)
                            // nb. do not exit with the error to avoid interrupting listener and command (more warn than error).
                            showError(COMMAND_ERRORS.COMMAND_CONTRIBUTE_NO_CURRENT_CONTRIBUTOR_CONTRIBUTION, false)
                        else {
                            // Get the contribution.
                            const currentContributorContribution = currentContributorContributions.at(0)!

                            const { data } = currentContributorContribution

                            process.stdout.write(
                                `   ${
                                    data.valid ? theme.symbols.success : theme.symbols.warning
                                } Contribution ${theme.text.bold(`#${nextZkeyIndex}`)} is ${
                                    data?.valid
                                        ? `valid and the next contributor must use it to compute the next contribution.`
                                        : `invalid and must be computed by next contributor.`
                                }`
                            )
                        }

                        // Unsubscribe.
                        unsubscriberToCircuitCurrentContributorDocument()
                        break
                    }
                    default: {
                        // Something wrong happened when updating the contributionStep of the participant.
                        showError(COMMAND_ERRORS.COMMAND_CONTRIBUTE_WRONG_CURRENT_CONTRIBUTOR_CONTRIBUTION_STEP, true)

                        unsubscriberToCircuitCurrentContributorDocument()
                        break
                    }
                }
            }
        }
    )
}

/**
 * Listen to circuit document changes.
 * @notice the circuit is the one for which the participant wants to contribute.
 * @dev display custom messages in order to make the participant able to follow what's going while waiting in the queue.
 * Also, this listener use another listener for the current circuit contributor in order to inform the waiting participant about the current contributor's progress.
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param participantId <string> - the unique identifier of the participant.
 * @param circuit <FirebaseDocumentInfo> - the Firestore document info about the circuit.
 */
const listenToCeremonyCircuitDocumentChanges = (
    firestoreDatabase: Firestore,
    ceremonyId: string,
    participantId: string,
    circuit: FirebaseDocumentInfo
) => {
    console.log(
        `${theme.text.bold(
            `\n- Circuit # ${theme.colors.magenta(`${circuit.data.sequencePosition}`)}`
        )} (Waiting Queue)`
    )

    const unsubscribeToCeremonyCircuitListener = onSnapshot(circuit.ref, async (changedCircuit: DocumentSnapshot) => {
        // Check data.
        if (!circuit.data || !changedCircuit.data()) showError(COMMAND_ERRORS.COMMAND_CONTRIBUTE_NO_CIRCUIT_DATA, true)

        // Extract data.
        const { avgTimings, waitingQueue } = changedCircuit.data()!
        const { fullContribution, verifyCloudFunction } = avgTimings
        const { currentContributor, completedContributions } = waitingQueue

        // Get circuit current contributor participant document.
        const circuitCurrentContributor = await getDocumentById(
            firestoreDatabase,
            getParticipantsCollectionPath(ceremonyId),
            currentContributor
        )

        // Check data.
        if (!circuitCurrentContributor.data())
            showError(COMMAND_ERRORS.COMMAND_CONTRIBUTE_NO_CURRENT_CONTRIBUTOR_DATA, true)

        // Get participant position in the waiting queue of the circuit.
        const latestParticipantPositionInQueue = waitingQueue.contributors.indexOf(participantId) + 1

        // Compute time estimation based on latest participant position in the waiting queue.
        const newEstimatedWaitingTime =
            fullContribution <= 0 && verifyCloudFunction <= 0
                ? 0
                : (fullContribution + verifyCloudFunction) * (latestParticipantPositionInQueue - 1)

        // Extract time.
        const { seconds, minutes, hours, days } = getSecondsMinutesHoursFromMillis(newEstimatedWaitingTime)

        // Check if the participant is now the new current contributor for the circuit.
        if (latestParticipantPositionInQueue === 1) {
            console.log(`\n${theme.symbols.info} Your contribution will begin shortly ${theme.emojis.tada}`)

            // Unsubscribe from updates.
            unsubscribeToCeremonyCircuitListener()
        } else {
            // Display updated position and waiting time.
            console.log(
                `\n${theme.symbols.info} ${`You will have to wait for ${theme.text.bold(
                    theme.colors.magenta(latestParticipantPositionInQueue - 1)
                )} contributors`} (~${
                    newEstimatedWaitingTime > 0
                        ? `${theme.text.bold(
                              `${convertToDoubleDigits(days)}:${convertToDoubleDigits(hours)}:${convertToDoubleDigits(
                                  minutes
                              )}:${convertToDoubleDigits(seconds)}`
                          )}`
                        : `no time`
                } (dd/hh/mm/ss))`
            )

            // Listen to circuit current contributor document changes.
            await listenToCircuitCurrentContributorDocumentChanges(
                firestoreDatabase,
                ceremonyId,
                circuit.id,
                circuitCurrentContributor,
                completedContributions
            )
        }
    })
}

/**
 * Listen to current authenticated participant document changes.
 * @dev this is the core business logic related to the execution of the contribute command.
 * Basically, the command follows the updates of circuit waiting queue, participant status and contribution steps,
 * while covering aspects regarding memory requirements, contribution completion or resumability, interaction w/ cloud functions, and so on.
 * @notice in order to compute a contribute for each circuit, this method follows several steps:
 * 1) Checking participant memory availability on root disk before joining for the first contribution (circuit having circuitPosition = 1).
 * 2) Check if the participant has not completed the contributions for every circuit or has just finished contributing.
 * 3) If (2) is true:
 *  3.A) Check if the participant switched to `WAITING` as contribution status.
 *      3.A.1) if true; display circuit waiting queue updates to the participant (listener to circuit document changes).
 *      3.A.2) otherwise; do nothing and continue with other checks.
 *  3.B) Check if the participant switched to `CONTRIBUTING` status. The participant must be the current contributor for the circuit w/ a resumable contribution step.
 *      3.B.1) if true; start or resume the contribution from last contribution step.
 *      3.B.2) otherwise; do nothing and continue with other checks.
 *  3.C) Check if the current contributor is resuming from the "VERIFYING" contribution step.
 *      3.C.1) if true; display previous completed steps and wait for verification results.
 *      3.C.2) otherwise; do nothing and continue with other checks.
 *  3.D) Check if the 'verifycontribution' cloud function has successfully completed the execution.
 *      3.D.1) if true; get and display contribution verification results.
 *      3.D.2) otherwise; do nothing and continue with other checks.
 *  3.E) Check if the participant experiences a timeout while contributing.
 *      3.E.1) if true; display timeout message and gracefully terminate.
 *      3.E.2) otherwise; do nothing and continue with other checks.
 *  3.F) Check if the participant has completed the contribution or is trying to resume the contribution after timeout expiration.
 *      3.F.1) if true; check the memory requirement for next/current (completed/resuming) contribution while
 *             handling early interruption of contributions resulting in a final public attestation generation.
 *             (this allows a user to stop their contributions to a certain circuit X if their cannot provide/do not own
 *              an adequate amount of memory for satisfying the memory requirements of the next/current contribution).
 *      3.F.2) otherwise; do nothing and continue with other checks.
 *  3.G) Check if the participant has already contributed to every circuit when running the command.
 *      3.G.1) if true; generate public final attestation and gracefully exit.
 *      3.G.2) otherwise; do nothing
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @param cloudFunctions <Functions> - the instance of the Firebase cloud functions for the application.
 * @param participant <DocumentSnapshot<DocumentData>> - the Firestore document of the participant.
 * @param ceremony <FirebaseDocumentInfo> - the Firestore document info about the selected ceremony.
 * @param entropy <string> - the random value (aka toxic waste) entered by the participant for the contribution.
 * @param providerUserId <string> - the unique provider user identifier associated to the authenticated account.
 * @param accessToken <string> - the Github token generated through the Device Flow process.
 */
const listenToParticipantDocumentChanges = async (
    firestoreDatabase: Firestore,
    cloudFunctions: Functions,
    participant: DocumentSnapshot<DocumentData>,
    ceremony: FirebaseDocumentInfo,
    entropy: string,
    providerUserId: string,
    accessToken: string
) => {
    // Listen to participant document changes.
    // nb. this listener encapsulates the core business logic of the contribute command.
    // the `changedParticipant` is the updated version (w/ newest changes) of the participant's document.
    const unsubscribe = onSnapshot(participant.ref, async (changedParticipant: DocumentSnapshot) => {
        // Check data.
        if (!participant.data() || !changedParticipant.data())
            showError(COMMAND_ERRORS.COMMAND_CONTRIBUTE_NO_PARTICIPANT_DATA, true)

        // Extract data.
        const {
            contributionProgress: prevContributionProgress,
            status: prevStatus,
            contributions: prevContributions,
            contributionStep: prevContributionStep,
            tempContributionData: prevTempContributionData
        } = participant.data()!

        const {
            contributionProgress: changedContributionProgress,
            status: changedStatus,
            contributionStep: changedContributionStep,
            contributions: changedContributions,
            tempContributionData: changedTempContributionData,
            verificationStartedAt: changedVerificationStartedAt
        } = changedParticipant.data()!

        // Get latest updates from ceremony circuits.
        const circuits = await getCeremonyCircuits(firestoreDatabase, ceremony.id)

        // Step (1).
        // Handle disk space requirement check for first contribution.
        if (
            changedStatus === ParticipantStatus.WAITING &&
            !changedContributionStep &&
            !changedContributions.length &&
            !changedContributionProgress
        ) {
            // Get circuit by sequence position among ceremony circuits.
            const circuit = getCircuitBySequencePosition(circuits, changedContributionProgress + 1)

            // Extract data.
            const { sequencePosition, zKeySizeInBytes } = circuit.data

            // Check participant disk space availability for next contribution.
            await handleDiskSpaceRequirementForNextContribution(
                cloudFunctions,
                ceremony.id,
                sequencePosition,
                zKeySizeInBytes,
                false
            )
        }

        // Step (2).
        if (changedContributionProgress > 0 && changedContributionProgress <= circuits.length) {
            // Step (3).
            // Get circuit for which the participant wants to contribute.
            const circuit = circuits[changedContributionProgress - 1]

            // Check data.
            if (!circuit.data) showError(COMMAND_ERRORS.COMMAND_CONTRIBUTE_NO_CIRCUIT_DATA, true)

            // Extract circuit data.
            const { waitingQueue } = circuit.data

            // Define pre-conditions for different scenarios.
            const isWaitingForContribution = changedStatus === ParticipantStatus.WAITING

            const isCurrentContributor =
                changedStatus === ParticipantStatus.CONTRIBUTING && waitingQueue.currentContributor === participant.id

            const isResumingContribution =
                changedContributionStep === prevContributionStep &&
                changedContributionProgress === prevContributionProgress

            const noStatusChanges = changedStatus === prevStatus

            const progressToNextContribution = changedContributionStep === ParticipantContributionStep.COMPLETED

            const completedContribution = progressToNextContribution && changedStatus === ParticipantStatus.CONTRIBUTED

            const timeoutTriggeredWhileContributing =
                changedStatus === ParticipantStatus.TIMEDOUT &&
                changedContributionStep !== ParticipantContributionStep.COMPLETED

            const timeoutExpired = changedStatus === ParticipantStatus.EXHUMED

            const alreadyContributedToEveryCeremonyCircuit =
                changedStatus === ParticipantStatus.DONE &&
                changedContributionStep === ParticipantContributionStep.COMPLETED &&
                changedContributionProgress === circuits.length &&
                changedContributions.length === circuits.length

            const noTemporaryContributionData = !prevTempContributionData && !changedTempContributionData

            const samePermanentContributionData =
                (!prevContributions && !changedContributions) ||
                prevContributions.length === changedContributions.length

            const downloadingStep = changedContributionStep === ParticipantContributionStep.DOWNLOADING
            const computingStep = changedContributionStep === ParticipantContributionStep.COMPUTING
            const uploadingStep = changedContributionStep === ParticipantContributionStep.UPLOADING

            const hasResumableStep = downloadingStep || computingStep || uploadingStep

            const resumingContribution =
                prevContributionStep === changedContributionStep &&
                prevStatus === changedStatus &&
                prevContributionProgress === changedContributionProgress

            const resumingContributionButAdvancedToAnotherStep = prevContributionStep !== changedContributionStep

            const resumingAfterTimeoutExpiration = prevStatus === ParticipantStatus.EXHUMED

            const neverResumedContribution = !prevContributionStep

            const resumingWithSameTemporaryData =
                !!prevTempContributionData &&
                !!changedTempContributionData &&
                JSON.stringify(Object.keys(prevTempContributionData).sort()) ===
                    JSON.stringify(Object.keys(changedTempContributionData).sort()) &&
                JSON.stringify(Object.values(prevTempContributionData).sort()) ===
                    JSON.stringify(Object.values(changedTempContributionData).sort())

            const startingOrResumingContribution =
                // Pre-condition W => contribute / resume when contribution step = DOWNLOADING.
                (isCurrentContributor &&
                    downloadingStep &&
                    (resumingContribution ||
                        resumingContributionButAdvancedToAnotherStep ||
                        resumingAfterTimeoutExpiration ||
                        neverResumedContribution)) ||
                // Pre-condition X => contribute / resume when contribution step = COMPUTING.
                (computingStep && resumingContribution && samePermanentContributionData) ||
                // Pre-condition Y => contribute / resume when contribution step = UPLOADING without any pre-uploaded chunk.
                (uploadingStep && resumingContribution && noTemporaryContributionData) ||
                // Pre-condition Z => contribute / resume when contribution step = UPLOADING w/ some pre-uploaded chunk.
                (!noTemporaryContributionData && resumingWithSameTemporaryData)

            // Scenario (3.B).
            if (isCurrentContributor && hasResumableStep && startingOrResumingContribution) {
                // Communicate resume / start of the contribution to participant.
                await simpleLoader(
                    `${
                        changedContributionStep === ParticipantContributionStep.DOWNLOADING ? `Starting` : `Resuming`
                    } your contribution...`,
                    `clock`,
                    3000
                )

                // Start / Resume the contribution for the participant.
                await handleStartOrResumeContribution(
                    cloudFunctions,
                    firestoreDatabase,
                    ceremony,
                    circuit,
                    participant,
                    entropy,
                    providerUserId,
                    false // not finalizing.
                )
            }
            // Scenario (3.A).
            else if (isWaitingForContribution)
                listenToCeremonyCircuitDocumentChanges(firestoreDatabase, ceremony.id, participant.id, circuit)

            // Scenario (3.C).
            // Pre-condition: current contributor + resuming from verification step.
            if (
                isCurrentContributor &&
                isResumingContribution &&
                changedContributionStep === ParticipantContributionStep.VERIFYING
            ) {
                const spinner = customSpinner(`Getting info about your current contribution...`, `clock`)
                spinner.start()

                // Get current and next index.
                const currentZkeyIndex = formatZkeyIndex(changedContributionProgress)
                const nextZkeyIndex = formatZkeyIndex(changedContributionProgress + 1)

                // Get average verification time (Cloud Function).
                const avgVerifyCloudFunctionTime = circuit.data.avgTimings.verifyCloudFunction
                // Compute estimated time left for this contribution verification.
                const estimatedTimeLeftForVerification =
                    avgVerifyCloudFunctionTime - (Date.now() - changedVerificationStartedAt)
                // Format time.
                const { seconds, minutes, hours } = getSecondsMinutesHoursFromMillis(estimatedTimeLeftForVerification)

                spinner.stop()

                console.log(
                    `${theme.text.bold(
                        `\n- Circuit # ${theme.colors.magenta(`${circuit.data.sequencePosition}`)}`
                    )} (Contribution Steps)`
                )
                console.log(
                    `${theme.symbols.success} Contribution ${theme.text.bold(`#${currentZkeyIndex}`)} downloaded`
                )
                console.log(`${theme.symbols.success} Contribution ${theme.text.bold(`#${nextZkeyIndex}`)} computed`)
                console.log(
                    `${theme.symbols.success} Contribution ${theme.text.bold(`#${nextZkeyIndex}`)} saved on storage`
                )

                /// @todo resuming a contribution verification could potentially lead to no verification at all #18.
                console.log(
                    `${theme.symbols.info} Contribution verification in progress (time left ${theme.text.bold(
                        `${convertToDoubleDigits(hours)}:${convertToDoubleDigits(minutes)}:${convertToDoubleDigits(
                            seconds
                        )}`
                    )})`
                )
            }

            // Scenario (3.D).
            // Pre-condition: contribution has been verified and,
            // contributor status: DONE if completed all contributions or CONTRIBUTED if just completed the last one (not all).
            if (
                progressToNextContribution &&
                noStatusChanges &&
                (changedStatus === ParticipantStatus.DONE || changedStatus === ParticipantStatus.CONTRIBUTED)
            ) {
                const spinner = customSpinner(`Getting info about the verification of your contribution...`, `clock`)
                spinner.start()

                // Get circuit contribution from contributor.
                const circuitContributionsFromContributor = await getCircuitContributionsFromContributor(
                    firestoreDatabase,
                    ceremony.id,
                    circuit.id,
                    participant.id
                )

                const contribution = circuitContributionsFromContributor.at(0)

                spinner.stop()

                console.log(
                    `${contribution?.data.valid ? theme.symbols.success : theme.symbols.error} Verification ${
                        contribution?.data.valid
                            ? `passed ${theme.text.bold("correct contribution")}`
                            : `failed ${theme.text.bold("invalid contribution")}`
                    }`
                )
            }

            // Scenario (3.E).
            if (timeoutTriggeredWhileContributing) {
                await handleTimedoutMessageForContributor(
                    firestoreDatabase,
                    participant.id,
                    ceremony.id,
                    changedContributionProgress,
                    true
                )

                terminate(providerUserId)
            }

            // Scenario (3.F).
            if (completedContribution || timeoutExpired) {
                // Get next circuit for contribution.
                const nextCircuit = getCircuitBySequencePosition(circuits, changedContributionProgress + 1)

                // Check disk space requirements for participant.
                const wannaGenerateAttestation = await handleDiskSpaceRequirementForNextContribution(
                    cloudFunctions,
                    ceremony.id,
                    nextCircuit.data.sequencePosition,
                    nextCircuit.data.zKeySizeInBytes,
                    timeoutExpired
                )

                // Check if the participant would like to generate a new attestation.
                if (wannaGenerateAttestation) {
                    // Handle public attestation generation and operations.
                    await handlePublicAttestation(
                        firestoreDatabase,
                        circuits,
                        ceremony.id,
                        participant.id,
                        changedContributions,
                        providerUserId,
                        ceremony.data.title,
                        ceremony.data.prefix,
                        accessToken
                    )

                    console.log(
                        `\nThank you for participating and securing the ${ceremony.data.title} ceremony ${theme.emojis.pray}`
                    )

                    // Unsubscribe from listener.
                    unsubscribe()

                    // Gracefully exit.
                    terminate(providerUserId)
                }
            }

            // Scenario (3.G).
            if (alreadyContributedToEveryCeremonyCircuit) {
                // Handle public attestation generation and operations.
                await handlePublicAttestation(
                    firestoreDatabase,
                    circuits,
                    ceremony.id,
                    participant.id,
                    changedContributions,
                    providerUserId,
                    ceremony.data.title,
                    ceremony.data.prefix,
                    accessToken
                )

                console.log(
                    `\nThank you for participating and securing the ${ceremony.data.title} ceremony ${theme.emojis.pray}`
                )

                // Unsubscribe from listener.
                unsubscribe()

                // Gracefully exit.
                terminate(providerUserId)
            }
        }
    })
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
    const { user, providerUserId, token } = await checkAuth(firebaseApp)

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
    const selectedCeremony = await promptForCeremonySelection(ceremoniesOpenedForContributions, false)

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

        // Listener to following the core contribution workflow.
        await listenToParticipantDocumentChanges(
            firestoreDatabase,
            firebaseFunctions,
            participant,
            selectedCeremony,
            entropy,
            providerUserId,
            token
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

            // await handleContributionValidity(firestoreDatabase, circuits, selectedCeremony.id, participant.id)

            spinner.text = "Checking your public attestation gist..."
            spinner.start()

            // Check whether the user has published the Github Gist about the public attestation.
            const publishedPublicAttestationGist = await getPublicAttestationGist(
                token,
                `${selectedCeremony.data.prefix}_${commonTerms.foldersAndPathsTerms.attestation}.log`
            )

            if (!publishedPublicAttestationGist) {
                spinner.stop()

                await handlePublicAttestation(
                    firestoreDatabase,
                    circuits,
                    selectedCeremony.id,
                    participant.id,
                    participantData?.contributions!,
                    providerUserId,
                    selectedCeremony.data.title,
                    selectedCeremony.data.prefix,
                    token
                )
            } else {
                // Extract url from raw.
                const gistUrl = publishedPublicAttestationGist.raw_url.substring(
                    0,
                    publishedPublicAttestationGist.raw_url.indexOf("/raw/")
                )

                spinner.stop()

                process.stdout.write(`\n`)
                console.log(
                    `${
                        theme.symbols.success
                    } Your public attestation has been successfully posted as Github Gist (${theme.text.bold(
                        theme.text.underlined(gistUrl)
                    )})`
                )

                // Prepare a ready-to-share tweet.
                await handleTweetGeneration(selectedCeremony.data.title, gistUrl)
            }

            console.log(
                `\nThank you for participating and securing the ${selectedCeremony.data.title} ceremony ${theme.emojis.pray}`
            )
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
        terminate(providerUserId)
    }
}

export default contribute
