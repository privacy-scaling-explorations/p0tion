import { COMMAND_ERRORS, showError } from "../../lib/errors.js"
import { checkAndRetrieveJWTAuth } from "../../lib-api/auth.js"
import theme from "../../lib/theme.js"
import {
    CeremonyDocumentAPI,
    ParticipantDocumentAPI,
    getCurrentParticipantAPI,
    checkParticipantForCeremonyAPI,
    getOpenedCeremoniesAPI,
    getCeremonyCircuitsAPI,
    getParticipantAPI,
    getCircuitBySequencePositionAPI,
    ParticipantContributionStep,
    ParticipantStatus,
    commonTerms,
    convertBytesOrKbToGb,
    progressToNextCircuitForContributionAPI,
    resumeContributionAfterTimeoutExpirationAPI,
    generateValidContributionsAttestationAPI,
    getCurrentActiveParticipantTimeoutAPI,
    ContributionValidity,
    getContributionsValidityForContributorAPI
} from "@p0tion/actions"
import {
    customSpinner,
    estimateParticipantFreeGlobalDiskSpace,
    getPublicAttestationGist,
    getSecondsMinutesHoursFromMillis,
    publishGist,
    simpleLoader,
    sleep,
    terminate
} from "../../lib/utils.js"
import { askForConfirmation, promptForCeremonySelectionAPI, promptForEntropy } from "../../lib/prompts.js"
import { checkAndMakeNewDirectoryIfNonexistent, writeFile } from "../../lib/files.js"
import { getAttestationLocalFilePath, getLocalAuthMethod, localPaths } from "../../lib/localConfigs.js"
import { handleTweetGeneration } from "../contribute.js"
import { CircuitDocumentAPI } from "@p0tion/actions"
import { ParticipantContributionDocumentAPI, ContributionValidityAPI } from "@p0tion/actions"
import { convertToDoubleDigits } from "@p0tion/actions"

export const handleTimedoutMessageForContributor = async (
    accessToken: string,
    participantId: string,
    ceremonyId: number,
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
    const activeTimeouts = await getCurrentActiveParticipantTimeoutAPI(accessToken, ceremonyId, participantId)

    if (activeTimeouts.length !== 1) showError(COMMAND_ERRORS.COMMAND_CONTRIBUTE_NO_UNIQUE_ACTIVE_TIMEOUTS, true)

    // Get active timeout.
    const activeTimeout = activeTimeouts.at(0)!

    if (!activeTimeout) showError(COMMAND_ERRORS.COMMAND_CONTRIBUTE_NO_ACTIVE_TIMEOUT_DATA, true)

    // Extract data.
    const { endDate } = activeTimeout

    const { seconds, minutes, hours, days } = getSecondsMinutesHoursFromMillis(Number(endDate) - Date.now())

    console.log(
        `${theme.symbols.info} Your timeout will end in ${theme.text.bold(
            `${convertToDoubleDigits(days)}:${convertToDoubleDigits(hours)}:${convertToDoubleDigits(
                minutes
            )}:${convertToDoubleDigits(seconds)}`
        )} (dd/hh/mm/ss)`
    )
}

export const handleDiskSpaceRequirementForNextContribution = async (
    accessToken: string,
    ceremonyId: number,
    circuitSequencePosition: number,
    circuitZkeySizeInBytes: number,
    isResumingAfterTimeout: boolean,
    providerUserId: string
): Promise<boolean> => {
    let wannaContributeOrHaveEnoughMemory: boolean = false // true when the contributor has enough memory or wants to contribute in any case; otherwise false.

    // Custom spinner.
    const spinner = customSpinner(`Checking disk space requirement for next contribution...`, `clock`)
    spinner.start()

    // Compute disk space requirement to support circuit contribution (zKey size * 2).
    const contributionDiskSpaceRequirement = convertBytesOrKbToGb(circuitZkeySizeInBytes * 2, true)
    // Get participant available disk space.
    const participantFreeDiskSpace = convertBytesOrKbToGb(estimateParticipantFreeGlobalDiskSpace(), false)

    // Check.
    if (participantFreeDiskSpace < contributionDiskSpaceRequirement) {
        spinner.fail(
            `You may not have enough memory to calculate the contribution for the Circuit ${theme.colors.magenta(
                `${circuitSequencePosition}`
            )}.\n\n${theme.symbols.info} The required amount of disk space is ${
                contributionDiskSpaceRequirement < 0.01
                    ? theme.text.bold(`< 0.01`)
                    : theme.text.bold(contributionDiskSpaceRequirement)
            } GB but you only have ${
                participantFreeDiskSpace > 0 ? theme.text.bold(participantFreeDiskSpace.toFixed(2)) : theme.text.bold(0)
            } GB available memory \nThe estimate ${theme.text.bold(
                "may not be 100% correct"
            )} since is based on the aggregate free memory on your disks but some may not be detected!\n`
        )

        const { confirmationEnoughMemory } = await askForConfirmation(
            `Please, we kindly ask you to continue with the contribution if you have noticed the estimate is wrong and you have enough memory in your machine`,
            "Continue",
            "Exit"
        )
        wannaContributeOrHaveEnoughMemory = !!confirmationEnoughMemory

        if (circuitSequencePosition > 1) {
            console.log(
                `${theme.symbols.info} Please note, you have time until ceremony ends to free up your memory and complete remaining contributions`
            )

            // Asks the contributor if their wants to terminate contributions for the ceremony.
            const { confirmation } = await askForConfirmation(
                `Please note, this action is irreversible! Do you want to end your contributions for the ceremony?`
            )

            return !!confirmation
        }
    } else wannaContributeOrHaveEnoughMemory = true

    if (wannaContributeOrHaveEnoughMemory) {
        spinner.succeed(
            `Memory requirement to contribute to ${theme.text.bold(
                `Circuit ${theme.colors.magenta(`${circuitSequencePosition}`)}`
            )} satisfied`
        )

        // Memory requirement for next contribution met.
        if (!isResumingAfterTimeout) {
            spinner.text = "Progressing to next circuit for contribution..."
            spinner.start()

            // Progress the participant to the next circuit making it ready for contribution.
            await progressToNextCircuitForContributionAPI(accessToken, ceremonyId)
        } else {
            spinner.text = "Resuming your contribution after timeout expiration..."
            spinner.start()

            // Resume contribution after timeout expiration (same circuit).
            await resumeContributionAfterTimeoutExpirationAPI(accessToken, ceremonyId)
        }

        spinner.info(
            `Joining the ${theme.text.bold(
                `Circuit ${theme.colors.magenta(`${circuitSequencePosition}`)}`
            )} waiting queue for contribution (this may take a while)`
        )

        return false
    }
    terminate(providerUserId)

    return false
}

export const listenToParticipantDocumentChangesAPI = async (
    participant: ParticipantDocumentAPI,
    ceremony: CeremonyDocumentAPI,
    entropy: string,
    providerUserId: string,
    accessToken: string
) => {
    // Extract data.
    const {
        contributionProgress: prevContributionProgress,
        status: prevStatus,
        contributions: prevContributions,
        contributionStep: prevContributionStep,
        tempContributionData: prevTempContributionData
    } = participant

    // Get latest updates from ceremony circuits.
    const circuits = await getCeremonyCircuitsAPI(ceremony.id)

    let isYourTurn = false
    while (!isYourTurn) {
        const currentParticipant = await getCurrentParticipantAPI(accessToken, ceremony.id)
        const {
            contributionProgress: changedContributionProgress,
            status: changedStatus,
            contributionStep: changedContributionStep,
            contributions: changedContributions,
            tempContributionData: changedTempContributionData,
            verificationStartedAt: changedVerificationStartedAt
        } = currentParticipant
        console.log(currentParticipant)

        // Step (1).
        // Handle disk space requirement check for first contribution.
        if (
            changedStatus === ParticipantStatus.WAITING &&
            !changedContributionStep &&
            changedContributions!.length &&
            !changedContributionProgress
        ) {
            // Get circuit by sequence position among ceremony circuits.
            const circuit = getCircuitBySequencePositionAPI(circuits, changedContributionProgress + 1)

            // Extract data.
            const { sequencePosition, zKeySizeInBytes } = circuit

            // Check participant disk space availability for next contribution.
            await handleDiskSpaceRequirementForNextContribution(
                accessToken,
                ceremony.id,
                sequencePosition,
                zKeySizeInBytes,
                false,
                providerUserId
            )
        }
    }
}

export const displayContributionValidity = (contributionsWithValidity: Array<ContributionValidityAPI>) => {
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

export const handleContributionValidity = async (
    accessToken: string,
    circuits: Array<CircuitDocumentAPI>,
    ceremonyId: number,
    participantId: string
) => {
    // Get contributors' contributions validity.
    const contributionsWithValidity = await getContributionsValidityForContributorAPI(
        accessToken,
        circuits,
        ceremonyId,
        participantId,
        false
    )

    // Filter only valid contributions.
    const validContributions = contributionsWithValidity.filter(
        (contributionWithValidity: ContributionValidityAPI) => contributionWithValidity.valid
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

export const generatePublicAttestation = async (
    accessToken: string,
    circuits: Array<CircuitDocumentAPI>,
    ceremonyId: number,
    participantId: string,
    participantContributions: Array<ParticipantContributionDocumentAPI>,
    contributorIdentifier: string,
    ceremonyName: string
): Promise<string> => {
    // Display contribution validity.
    await handleContributionValidity(accessToken, circuits, ceremonyId, participantId)

    await sleep(3000)

    // Get only valid contribution hashes.
    return generateValidContributionsAttestationAPI(
        accessToken,
        circuits,
        ceremonyId,
        participantId,
        participantContributions,
        contributorIdentifier,
        ceremonyName,
        false
    )
}

export const handlePublicAttestation = async (
    accessToken: string,
    circuits: Array<CircuitDocumentAPI>,
    ceremonyId: number,
    participantId: string,
    participantContributions: Array<ParticipantContributionDocumentAPI>,
    contributorIdentifier: string,
    ceremonyName: string,
    ceremonyPrefix: string,
    participantAccessToken: string
) => {
    await simpleLoader(`Generating your public attestation...`, `clock`, 3000)

    // Generate attestation with valid contributions.
    const publicAttestation = await generatePublicAttestation(
        accessToken,
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

    let gistUrl = ""
    const isGithub = getLocalAuthMethod() === "github"
    if (isGithub) {
        gistUrl = await publishGist(participantAccessToken, publicAttestation, ceremonyName, ceremonyPrefix)

        console.log(
            `\n${
                theme.symbols.info
            } Your public attestation has been successfully posted as Github Gist (${theme.text.bold(
                theme.text.underlined(gistUrl)
            )})`
        )
    }
    // Prepare a ready-to-share tweet.
    await handleTweetGeneration(ceremonyName, gistUrl)
}

const contribute = async (cmd: { ceremony?: string; entropy?: string; auth?: string }) => {
    const { token, user } = checkAndRetrieveJWTAuth(cmd.auth)
    // Prepare data.
    let selectedCeremony: CeremonyDocumentAPI
    // Retrieve the opened ceremonies.
    const ceremoniesOpenedForContributions = await getOpenedCeremoniesAPI()

    // Gracefully exit if no ceremonies are opened for contribution.
    if (!ceremoniesOpenedForContributions.length)
        showError(COMMAND_ERRORS.COMMAND_CONTRIBUTE_NO_OPENED_CEREMONIES, true)

    console.log(
        `${theme.symbols.warning} ${theme.text.bold(
            `The contribution process is based on a parallel waiting queue mechanism allowing one contributor at a time per circuit with a maximum time upper-bound. Each contribution may require the bulk of your computing resources and memory based on the size of the circuit (ETAs could vary!). If you stop your contribution at any step, you have to restart the step from scratch (except for uploading).`
        )}\n`
    )

    if (cmd.ceremony) {
        // Check if the input ceremony title match with an opened ceremony.
        const selectedCeremonyDocument = ceremoniesOpenedForContributions.filter(
            (openedCeremony: CeremonyDocumentAPI) => openedCeremony.prefix === cmd.ceremony
        )

        if (selectedCeremonyDocument.length !== 1) {
            // Notify user about error.
            console.log(`${theme.symbols.error} ${COMMAND_ERRORS.COMMAND_CONTRIBUTE_WRONG_OPTION_CEREMONY}`)

            // Show potential ceremonies
            console.log(`${theme.symbols.info} Currently, you can contribute to the following ceremonies: `)

            for (const openedCeremony of ceremoniesOpenedForContributions)
                console.log(`- ${theme.text.bold(openedCeremony.prefix)}\n`)

            terminate(user.displayName)
        } else selectedCeremony = selectedCeremonyDocument.at(0)
    } else {
        // Prompt the user to select a ceremony from the opened ones.
        selectedCeremony = await promptForCeremonySelectionAPI(
            ceremoniesOpenedForContributions,
            false,
            "Which ceremony would you like to contribute to?"
        )
    }
    // Get selected ceremony circuit(s) documents
    const circuits = await getCeremonyCircuitsAPI(selectedCeremony.id)

    const spinner = customSpinner(`Verifying your participant status...`, `clock`)
    spinner.start()

    // Check the user's current participant readiness for contribution status (eligible, already contributed, timed out).
    const canParticipantContributeToCeremony = await checkParticipantForCeremonyAPI(token, selectedCeremony.id)
    const participant = await getParticipantAPI(token, selectedCeremony.id)

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
        const { contributionProgress, contributionStep } = participant
        // Check if the participant can input the entropy
        if (
            contributionProgress < circuits.length ||
            (contributionProgress === circuits.length && contributionStep < ParticipantContributionStep.UPLOADING)
        ) {
            if (cmd.entropy) entropy = cmd.entropy
            /// @todo should we preserve entropy between different re-run of the command? (e.g., resume after timeout).
            // Prompt for entropy generation.
            else entropy = await promptForEntropy()
        }

        // Listener to following the core contribution workflow.
        await listenToParticipantDocumentChangesAPI(participant, selectedCeremony, entropy, user.displayName, token)
    } else {
        // Extract participant data.
        const { status, contributionStep, contributionProgress } = participant

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
                `${selectedCeremony.prefix}_${commonTerms.foldersAndPathsTerms.attestation}.log`
            )

            if (!publishedPublicAttestationGist) {
                spinner.stop()

                await handlePublicAttestation(
                    token,
                    circuits,
                    selectedCeremony.id,
                    participant.userId,
                    participant.contributions,
                    user.displayName,
                    selectedCeremony.title,
                    selectedCeremony.prefix,
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
                await handleTweetGeneration(selectedCeremony.title, gistUrl)
            }

            console.log(
                `\nThank you for participating and securing the ${selectedCeremony.title} ceremony ${theme.emojis.pray}`
            )
        }

        // Check if there's a timeout still in effect for the participant.
        if (status === ParticipantStatus.TIMEDOUT && contributionStep !== ParticipantContributionStep.COMPLETED) {
            spinner.warn(`Oops, you are not allowed to continue your contribution due to current timeout`)

            await handleTimedoutMessageForContributor(
                token,
                participant.userId,
                selectedCeremony.id,
                contributionProgress,
                false
            )
        }

        // Exit gracefully.
        terminate(user.displayName)
    }
}

export default contribute
