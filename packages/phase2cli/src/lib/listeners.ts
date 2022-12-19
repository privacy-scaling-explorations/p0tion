import { DocumentData, DocumentSnapshot, Firestore, onSnapshot } from "firebase/firestore"
import { Functions, HttpsCallable, httpsCallable } from "firebase/functions"
import { 
    getCeremonyCircuits,
    getContributorContributionsVerificationResults,
    getCurrentContributorContribution,
    getDocumentById,
    getNextCircuitForContribution,
    makeProgressToNextContribution,
    resumeContributionAfterTimeoutExpiration,
    formatZkeyIndex,
    getZkeysSpaceRequirementsForContributionInGB
 } from "@zkmpc/actions"
import { FirebaseDocumentInfo, ParticipantContributionStep, ParticipantStatus } from "../../types/index"
import { collections, emojis, symbols, theme } from "./constants"
import {
    convertToDoubleDigits,
    customSpinner,
    generatePublicAttestation,
    getParticipantCurrentDiskAvailableSpace,
    getSecondsMinutesHoursFromMillis,
    handleTimedoutMessageForContributor,
    makeContribution,
    simpleCountdown,
    simpleLoader,
    terminate
} from "./utils"
import { GENERIC_ERRORS, showError } from "./errors"
import { askForConfirmation } from "./prompts"
import { convertToGB } from "./storage"


/**
 * Return the available disk space of the current contributor in GB.
 * @returns <number>
 */
const getContributorAvailableDiskSpaceInGB = (): number => convertToGB(getParticipantCurrentDiskAvailableSpace(), false)

/**
 * Check if the contributor has enough space before starting the contribution for next circuit.
 * @param functions <Functions> - the cloud functions.
 * @param nextCircuit <FirebaseDocumentInfo> - the circuit document.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @return <Promise<void>>
 */
const handleDiskSpaceRequirementForNextContribution = async (
    functions: Functions,
    nextCircuit: FirebaseDocumentInfo,
    ceremonyId: string,
    functionName: string = 'makeProgressToNextContribution'
): Promise<boolean> => {
    // Get memory info.
    const zKeysSpaceRequirementsInGB = getZkeysSpaceRequirementsForContributionInGB(nextCircuit.data.zKeySizeInBytes)
    const availableDiskSpaceInGB = getContributorAvailableDiskSpaceInGB()

    // Extract data.
    const { sequencePosition } = nextCircuit.data

    process.stdout.write(`\n`)

    await simpleLoader(`Checking your memory...`, `clock`, 1000)

    // Check memory requirement.
    if (availableDiskSpaceInGB < zKeysSpaceRequirementsInGB) {
        console.log(theme.bold(`- Circuit # ${theme.magenta(`${sequencePosition}`)}`))

        console.log(
            `${symbols.error} You do not have enough memory to make a contribution (Required ${
                zKeysSpaceRequirementsInGB < 0.01 ? theme.bold(`< 0.01`) : theme.bold(zKeysSpaceRequirementsInGB)
            } GB (available ${
                availableDiskSpaceInGB > 0 ? theme.bold(availableDiskSpaceInGB.toFixed(2)) : theme.bold(0)
            } GB)\n`
        )

        if (sequencePosition > 1) {
            // The user has computed at least one valid contribution. Therefore, can choose if free up memory and contrinue with next contribution or generate the final attestation.
            console.log(
                `${symbols.info} You have time until ceremony ends to free up your memory, complete contributions and publish the attestation`
            )

            const { confirmation } = await askForConfirmation(
                `Are you sure you want to generate and publish the attestation for your contributions?`
            )

            if (!confirmation) {
                process.stdout.write(`\n`)

                // nb. here the user is not able to generate an attestation because does not have contributed yet. Therefore, return an error and exit.
                showError(`Please, free up your disk space and run again this command to contribute`, true)
            }
        } else {
            // nb. here the user is not able to generate an attestation because does not have contributed yet. Therefore, return an error and exit.
            showError(`Please, free up your disk space and run again this command to contribute`, true)
        }
    } else {
        console.log(
            `${symbols.success} You have enough memory for contributing to ${theme.bold(
                `Circuit ${theme.magenta(sequencePosition)}`
            )}`
        )

        const spinner = customSpinner(
            `Joining ${theme.bold(`Circuit ${theme.magenta(sequencePosition)}`)} waiting queue...`,
            `clock`
        )
        spinner.start()

        functionName === 'makeProgressToNextContribution' ? 
        await makeProgressToNextContribution(functions, ceremonyId) : 
        await resumeContributionAfterTimeoutExpiration(functions, ceremonyId)

        spinner.succeed(`All set for contribution to ${theme.bold(`Circuit ${theme.magenta(sequencePosition)}`)}`)

        return false
    }

    return true
}

/**
 * Return the index of a given participant in a circuit waiting queue.
 * @param contributors <Array<string>> - the list of the contributors in queue for a circuit.
 * @param participantId <string> - the unique identifier of the participant.
 * @returns <number>
 */
const getParticipantPositionInQueue = (contributors: Array<string>, participantId: string): number =>
    contributors.indexOf(participantId) + 1

/**
 * Listen to circuit document changes and reacts in realtime.
 * @param firestoreDatabase <Firestore> - the Firestore db.
 * @param participantId <string> - the unique identifier of the contributor.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param circuit <FirebaseDocumentInfo> - the document information about the current circuit.
 */
const listenToCircuitChanges = (
    firestoreDatabase: Firestore, 
    participantId: string, 
    ceremonyId: string, 
    circuit: FirebaseDocumentInfo
) => {
    const unsubscriberForCircuitDocument = onSnapshot(circuit.ref, async (circuitDocSnap: DocumentSnapshot) => {
        // Get updated data from snap.
        const newCircuitData = circuitDocSnap.data()

        if (!newCircuitData) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

        // Get data.
        const { avgTimings, waitingQueue } = newCircuitData!
        const { fullContribution, verifyCloudFunction } = avgTimings
        const { currentContributor, completedContributions } = waitingQueue

        // Retrieve current contributor data.
        const currentContributorDoc = await getDocumentById(
            firestoreDatabase,
            `${collections.ceremonies}/${ceremonyId}/${collections.participants}`,
            currentContributor
        )

        // Get updated data from snap.
        const currentContributorData = currentContributorDoc.data()

        if (!currentContributorData) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

        // Get updated position for contributor in the queue.
        const newParticipantPositionInQueue = getParticipantPositionInQueue(waitingQueue.contributors, participantId)

        let newEstimatedWaitingTime = 0

        // Show new time estimation.
        if (fullContribution > 0 && verifyCloudFunction > 0)
            newEstimatedWaitingTime = (fullContribution + verifyCloudFunction) * (newParticipantPositionInQueue - 1)

        const {
            seconds: estSeconds,
            minutes: estMinutes,
            hours: estHours
        } = getSecondsMinutesHoursFromMillis(newEstimatedWaitingTime)

        // Check if is the current contributor.
        if (newParticipantPositionInQueue === 1) {
            console.log(
                `\n${symbols.success} Your turn has come ${emojis.tada}\n${symbols.info} Your contribution will begin soon`
            )
            unsubscriberForCircuitDocument()
        } else {
            // Position and time.
            console.log(
                `\n${symbols.info} ${
                    newParticipantPositionInQueue === 2
                        ? `You are the next contributor`
                        : `Your position in the waiting queue is ${theme.bold(
                              theme.magenta(newParticipantPositionInQueue - 1)
                          )}`
                } (${
                    newEstimatedWaitingTime > 0
                        ? `${theme.bold(
                              `${convertToDoubleDigits(estHours)}:${convertToDoubleDigits(
                                  estMinutes
                              )}:${convertToDoubleDigits(estSeconds)}`
                          )} left before your turn)`
                        : `no time estimation)`
                }`
            )

            // Participant data.
            console.log(` - Contributor # ${theme.bold(theme.magenta(completedContributions + 1))}`)

            // Data for displaying info about steps.
            const currentZkeyIndex = formatZkeyIndex(completedContributions)
            const nextZkeyIndex = formatZkeyIndex(completedContributions + 1)

            let interval: NodeJS.Timer

            const unsubscriberForCurrentContributorDocument = onSnapshot(
                currentContributorDoc.ref,
                async (currentContributorDocSnap: DocumentSnapshot) => {
                    // Get updated data from snap.
                    const newCurrentContributorData = currentContributorDocSnap.data()

                    if (!newCurrentContributorData) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

                    // Get current contributor data.
                    const { contributionStep, contributionStartedAt } = newCurrentContributorData!

                    // Average time.
                    const timeSpentWhileContributing = Date.now() - contributionStartedAt
                    const remainingTime = fullContribution - timeSpentWhileContributing

                    // Clear previous step interval (if exist).
                    if (interval) clearInterval(interval)

                    switch (contributionStep) {
                        case ParticipantContributionStep.DOWNLOADING: {
                            const message = `   ${symbols.info} Downloading contribution ${theme.bold(
                                `#${currentZkeyIndex}`
                            )}`
                            interval = simpleCountdown(remainingTime, message)

                            break
                        }
                        case ParticipantContributionStep.COMPUTING: {
                            process.stdout.write(
                                `   ${symbols.success} Contribution ${theme.bold(
                                    `#${currentZkeyIndex}`
                                )} correctly downloaded\n`
                            )

                            const message = `   ${symbols.info} Computing contribution ${theme.bold(
                                `#${nextZkeyIndex}`
                            )}`
                            interval = simpleCountdown(remainingTime, message)

                            break
                        }
                        case ParticipantContributionStep.UPLOADING: {
                            process.stdout.write(
                                `   ${symbols.success} Contribution ${theme.bold(
                                    `#${nextZkeyIndex}`
                                )} successfully computed\n`
                            )

                            const message = `   ${symbols.info} Uploading contribution ${theme.bold(
                                `#${nextZkeyIndex}`
                            )}`
                            interval = simpleCountdown(remainingTime, message)

                            break
                        }
                        case ParticipantContributionStep.VERIFYING: {
                            process.stdout.write(
                                `   ${symbols.success} Contribution ${theme.bold(
                                    `#${nextZkeyIndex}`
                                )} successfully uploaded\n`
                            )

                            const message = `   ${symbols.info} Contribution verification ${theme.bold(
                                `#${nextZkeyIndex}`
                            )}`
                            interval = simpleCountdown(remainingTime, message)

                            break
                        }
                        case ParticipantContributionStep.COMPLETED: {
                            process.stdout.write(
                                `   ${symbols.success} Contribution ${theme.bold(
                                    `#${nextZkeyIndex}`
                                )} has been correctly verified\n`
                            )

                            const currentContributorContributions = await getCurrentContributorContribution(
                                firestoreDatabase,
                                ceremonyId,
                                circuit.id,
                                currentContributorDocSnap.id
                            )

                            if (currentContributorContributions.length !== 1)
                                process.stdout.write(`   ${symbols.error} We could not recover the contribution data`)
                            else {
                                const contribution = currentContributorContributions.at(0)

                                const data = contribution?.data

                                console.log(
                                    `   ${data?.valid ? symbols.success : symbols.error} Contribution ${theme.bold(
                                        `#${nextZkeyIndex}`
                                    )} is ${data?.valid ? `VALID` : `INVALID`}`
                                )
                            }

                            unsubscriberForCurrentContributorDocument()
                            break
                        }
                        default: {
                            showError(`Wrong contribution step`, true)
                            break
                        }
                    }
                }
            )
        }
    })
}

// Listen to changes on the user-related participant document.
export default async (
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
                await handleDiskSpaceRequirementForNextContribution(
                    firebaseFunctions,
                    nextCircuit,
                    ceremony.id
                )
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
                        `${theme.bold(
                            `\n- Circuit # ${theme.magenta(`${circuit.data.sequencePosition}`)}`
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
                        `\n${symbols.success} Your contribution will ${
                            contributionStep === ParticipantContributionStep.DOWNLOADING ? `start` : `resume`
                        } soon ${emojis.clock}`
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

                    spinner.succeed(`Your contribution will resume soon ${emojis.clock}`)

                    console.log(
                        `${theme.bold(
                            `\n- Circuit # ${theme.magenta(`${circuit.data.sequencePosition}`)}`
                        )} (Contribution Steps)`
                    )
                    console.log(
                        `${symbols.success} Contribution ${theme.bold(`#${currentZkeyIndex}`)} already downloaded`
                    )
                    console.log(`${symbols.success} Contribution ${theme.bold(`#${nextZkeyIndex}`)} already computed`)
                    console.log(
                        `${symbols.success} Contribution ${theme.bold(`#${nextZkeyIndex}`)} already saved on storage`
                    )
                    console.log(
                        `${symbols.info} Contribution verification already started (est. time ${theme.bold(
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
                    console.log(`\n${symbols.success} Contribute verification has been completed`)

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
                        `${isContributionValid ? symbols.success : symbols.error} Your contribution ${
                            isContributionValid ? `is ${theme.bold("VALID")}` : `is ${theme.bold("INVALID")}`
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
                        'resumeContributionAfterTimeoutExpiration'
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
