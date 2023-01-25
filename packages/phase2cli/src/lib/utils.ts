import { request } from "@octokit/request"
import { DocumentData, Firestore, Timestamp } from "firebase/firestore"
import ora, { Ora } from "ora"
import { zKey } from "snarkjs"
import winston, { Logger } from "winston"
import { Functions } from "firebase/functions"
import { FirebaseStorage } from "firebase/storage"
import { Timer } from "timer-node"
import { getDiskInfoSync } from "node-disk-info"
import Drive from "node-disk-info/dist/classes/drive"
import open from "open"
import dotenv from "dotenv"
import {
    getBucketName,
    getContributorContributionsVerificationResults,
    getValidContributionAttestation,
    permanentlyStoreCurrentContributionTimeAndHash,
    uploadFileToStorage,
    progressToNextContributionStep,
    verifyContribution,
    getCurrentActiveParticipantTimeout,
    multiPartUpload,
    readFile,
    writeFile,
    readJSONFile,
    formatZkeyIndex
} from "@zkmpc/actions"
import { fileURLToPath } from "url"
import path from "path"
import { GithubAuthProvider, OAuthCredential } from "firebase/auth"
import {
    FirebaseDocumentInfo,
    ParticipantContributionStep,
    ParticipantStatus,
    Timing,
    VerifyContributionComputation
} from "../../types/index"
import { collections, emojis, numIterationsExp, paths, symbols, theme } from "./constants"
import { GENERIC_ERRORS, GITHUB_ERRORS, showError } from "./errors"
import { downloadLocalFileFromBucket } from "./storage"

dotenv.config()

/**
 * Exchange the Github token for OAuth credential.
 * @param githubToken <string> - the Github token generated through the Device Flow process.
 * @returns <OAuthCredential>
 */
export const exchangeGithubTokenForCredentials = (githubToken: string): OAuthCredential =>
    GithubAuthProvider.credential(githubToken)

/**
 * Get the Github handle associated to the account from which the token has been generated.
 * @param githubToken <string> - the Github token.
 * @returns <Promise<any>> - the Github handle of the user.
 */
export const getGithubUserHandle = async (githubToken: string): Promise<any> => {
    // Ask for user account public information through Github API.
    const response = await request("GET https://api.github.com/user", {
        headers: {
            authorization: `token ${githubToken}`
        }
    })

    if (response && response.status === 200) return response.data.login

    showError(GITHUB_ERRORS.GITHUB_GET_HANDLE_FAILED, true)
}

/**
 * Return the local current project directory name.
 * @returns <string> - the local project (e.g., dist/) directory name.
 */
export const getLocalDirname = (): string => {
    const filename = fileURLToPath(import.meta.url)
    return path.dirname(filename)
}

/**
 * Get a local file at a given path.
 * @param filePath <string>
 * @returns <any>
 */
export const getLocalFilePath = (filePath: string): any => path.join(getLocalDirname(), filePath)

/**
 * Read a local .json file at a given path.
 * @param filePath <string>
 * @returns <any>
 */
export const readLocalJsonFile = (filePath: string): any => readJSONFile(path.join(getLocalDirname(), filePath))

/**
 * Get the current amout of available memory for user root disk (mounted in `/` root).
 * @returns <number> - the available memory in kB.
 */
export const getParticipantCurrentDiskAvailableSpace = (): number => {
    const disks = getDiskInfoSync()
    const root = disks.filter((disk: Drive) => disk.mounted === `/`)

    if (root.length !== 1) showError(`Something went wrong while retrieving your root disk available memory`, true)

    const rootDisk = root.at(0)!

    return rootDisk.available
}

/**
 * Publish a new attestation through a Github Gist.
 * @param token <string> - the Github OAuth 2.0 token.
 * @param content <string> - the content of the attestation.
 * @param ceremonyPrefix <string> - the ceremony prefix.
 * @param ceremonyTitle <string> - the ceremony title.
 */
export const publishGist = async (
    token: string,
    content: string,
    ceremonyPrefix: string,
    ceremonyTitle: string
): Promise<string> => {
    const response = await request("POST /gists", {
        description: `Attestation for ${ceremonyTitle} MPC Phase 2 Trusted Setup ceremony`,
        public: true,
        files: {
            [`${ceremonyPrefix}_attestation.txt`]: {
                content
            }
        },
        headers: {
            authorization: `token ${token}`
        }
    })

    if (response && response.data.html_url) return response.data.html_url
    showError(GITHUB_ERRORS.GITHUB_GIST_PUBLICATION_FAILED, true)

    return process.exit(0) // nb. workaround to avoid type issues.
}

/**
 * Extract from milliseconds the seconds, minutes, hours and days.
 * @param millis <number>
 * @returns <Timing>
 */
export const getSecondsMinutesHoursFromMillis = (millis: number): Timing => {
    // Get seconds from millis.
    let delta = millis / 1000

    const days = Math.floor(delta / 86400)
    delta -= days * 86400

    const hours = Math.floor(delta / 3600) % 24
    delta -= hours * 3600

    const minutes = Math.floor(delta / 60) % 60
    delta -= minutes * 60

    const seconds = Math.floor(delta) % 60

    return {
        seconds: seconds >= 60 ? 59 : seconds,
        minutes: minutes >= 60 ? 59 : minutes,
        hours: hours >= 24 ? 23 : hours,
        days
    }
}

/**
 * Return a string with double digits if the amount is one digit only.
 * @param amount <number>
 * @returns <string>
 */
export const convertToDoubleDigits = (amount: number): string => (amount < 10 ? `0${amount}` : amount.toString())

/**
 * Sleeps the function execution for given millis.
 * @dev to be used in combination with loggers when writing data into files.
 * @param ms <number> - sleep amount in milliseconds
 * @returns <Promise<any>>
 */
export const sleep = (ms: number): Promise<any> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Return a custom spinner.
 * @param text <string> - the text that should be displayed as spinner status.
 * @param spinnerLogo <any> - the logo.
 * @returns <Ora> - a new Ora custom spinner.
 */
export const customSpinner = (text: string, spinnerLogo: any): Ora =>
    ora({
        text,
        spinner: spinnerLogo
    })

/**
 * Return a simple graphical loader to simulate loading or describe an asynchronous task.
 * @param loadingText <string> - the text that should be displayed while the loader is spinning.
 * @param logo <any> - the logo of the loader.
 * @param durationInMillis <number> - the loader duration time in milliseconds.
 * @param afterLoadingText <string> - the text that should be displayed for the loader stop.
 * @returns <Promise<void>>.
 */
export const simpleLoader = async (
    loadingText: string,
    logo: any,
    durationInMillis: number,
    afterLoadingText?: string
): Promise<void> => {
    // Define the loader.
    const loader = customSpinner(loadingText, logo)

    loader.start()

    // nb. wait for `durationInMillis` time while loader is spinning.
    await sleep(durationInMillis)

    if (afterLoadingText) loader.succeed(afterLoadingText)
    else loader.stop()
}

/**
 * Convert milliseconds to seconds.
 * @param millis <number>
 * @returns <number>
 */
export const convertMillisToSeconds = (millis: number): number => Number((millis / 1000).toFixed(2))

/**
 * Gracefully terminate the command execution
 * @params ghUsername <string> - the Github username of the user.
 */
export const terminate = async (ghUsername: string) => {
    console.log(`\nSee you, ${theme.bold(`@${ghUsername}`)} ${emojis.wave}`)

    process.exit(0)
}

/**
 * Make a new countdown and throws an error when time is up.
 * @param durationInSeconds <number> - the amount of time to be counted in seconds.
 * @param intervalInSeconds <number> - update interval in seconds.
 */
export const createExpirationCountdown = (durationInSeconds: number, intervalInSeconds: number) => {
    let seconds = durationInSeconds <= 60 ? durationInSeconds : 60

    setInterval(() => {
        try {
            if (durationInSeconds !== 0) {
                // Update times.
                durationInSeconds -= intervalInSeconds
                seconds -= intervalInSeconds

                if (seconds % 60 === 0) seconds = 0

                process.stdout.write(
                    `${symbols.warning} Expires in ${theme.bold(
                        theme.magenta(`00:${Math.floor(durationInSeconds / 60)}:${seconds}`)
                    )}\r`
                )
            } else showError(GENERIC_ERRORS.GENERIC_COUNTDOWN_EXPIRED, true)
        } catch (err: any) {
            // Workaround to the \r.
            process.stdout.write(`\n\n`)
            showError(GENERIC_ERRORS.GENERIC_COUNTDOWN_EXPIRATION, true)
        }
    }, intervalInSeconds * 1000)
}

/**
 * Create and return a simple countdown for a specified amount of time.
 * @param remainingTime <number> - the amount of time to be counted.
 * @param message <string> - the message to be shown.
 * @returns <NodeJS.Timer>
 */
export const simpleCountdown = (remainingTime: number, message: string): NodeJS.Timer =>
    setInterval(() => {
        remainingTime -= 1000

        const {
            seconds: cdSeconds,
            minutes: cdMinutes,
            hours: cdHours
        } = getSecondsMinutesHoursFromMillis(Math.abs(remainingTime))

        process.stdout.write(
            `${message} (${remainingTime < 0 ? theme.bold(`-`) : ``}${convertToDoubleDigits(
                cdHours
            )}:${convertToDoubleDigits(cdMinutes)}:${convertToDoubleDigits(cdSeconds)})\r`
        )
    }, 1000)

/**
 * Manage the communication of timeout-related messages for a contributor.
 * @param participantData <DocumentData> - the data of the participant document.
 * @param participantId <string> - the unique identifier of the contributor.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param isContributing <boolean>
 * @param ghUsername <string>
 */
export const handleTimedoutMessageForContributor = async (
    firestoreDatabase: Firestore,
    participantData: DocumentData,
    participantId: string,
    ceremonyId: string,
    isContributing: boolean,
    ghUsername: string
): Promise<void> => {
    // Extract data.
    const { status, contributionStep, contributionProgress } = participantData

    // Check if the contributor has been timedout.
    if (status === ParticipantStatus.TIMEDOUT && contributionStep !== ParticipantContributionStep.COMPLETED) {
        if (!isContributing) console.log(theme.bold(`\n- Circuit # ${theme.magenta(contributionProgress)}`))
        else process.stdout.write(`\n`)

        console.log(
            `${symbols.error} ${
                isContributing ? `You have been timedout while contributing` : `Timeout still in progress.`
            }\n\n${
                symbols.warning
            } This can happen due to network or memory issues, un/intentional crash, or contributions lasting for too long.`
        )

        // nb. workaround to retrieve the latest timeout data from the database.
        await simpleLoader(`Checking timeout...`, `clock`, 1000)

        // Check when the participant will be able to retry the contribution.
        const activeTimeouts = await getCurrentActiveParticipantTimeout(firestoreDatabase, ceremonyId, participantId)

        if (activeTimeouts.length !== 1) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

        const activeTimeoutData = activeTimeouts.at(0)?.data

        if (!activeTimeoutData) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

        const { seconds, minutes, hours, days } = getSecondsMinutesHoursFromMillis(
            Number(activeTimeoutData?.endDate) - Timestamp.now().toMillis()
        )

        console.log(
            `${symbols.info} You can retry your contribution in ${theme.bold(
                `${convertToDoubleDigits(days)}:${convertToDoubleDigits(hours)}:${convertToDoubleDigits(
                    minutes
                )}:${convertToDoubleDigits(seconds)}`
            )} (dd/hh/mm/ss)`
        )

        terminate(ghUsername)
    }
}

/**
 * Compute a new Groth 16 Phase 2 contribution.
 * @param lastZkey <string> - the local path to last zkey.
 * @param newZkey <string> - the local path to new zkey.
 * @param name <string> - the name of the contributor.
 * @param entropyOrBeacon <string> - the value representing the entropy or beacon.
 * @param logger <Logger | Console> - custom winston or console logger.
 * @param finalize <boolean> - true when finalizing the ceremony with the last contribution; otherwise false.
 * @param contributionComputationTime <number> - the contribution computation time in milliseconds for the circuit.
 */
export const computeContribution = async (
    lastZkey: string,
    newZkey: string,
    name: string,
    entropyOrBeacon: string,
    logger: Logger | Console,
    finalize: boolean,
    contributionComputationTime: number
) => {
    // Format average contribution time.
    const { seconds, minutes, hours } = getSecondsMinutesHoursFromMillis(contributionComputationTime)

    // Custom spinner for visual feedback.
    const text = `${finalize ? `Applying beacon...` : `Computing contribution...`} ${
        contributionComputationTime > 0
            ? `(ETA ${theme.bold(
                  `${convertToDoubleDigits(hours)}:${convertToDoubleDigits(minutes)}:${convertToDoubleDigits(seconds)}`
              )} |`
            : ``
    }`

    let counter = 0

    // Format time.
    const {
        seconds: counterSeconds,
        minutes: counterMinutes,
        hours: counterHours
    } = getSecondsMinutesHoursFromMillis(counter)

    const spinner = customSpinner(
        `${text} ${convertToDoubleDigits(counterHours)}:${convertToDoubleDigits(
            counterMinutes
        )}:${convertToDoubleDigits(counterSeconds)})\r`,
        `clock`
    )
    spinner.start()

    const interval = setInterval(() => {
        counter += 1000

        const {
            seconds: counterSec,
            minutes: counterMin,
            hours: counterHrs
        } = getSecondsMinutesHoursFromMillis(counter)

        spinner.text = `${text} ${convertToDoubleDigits(counterHrs)}:${convertToDoubleDigits(
            counterMin
        )}:${convertToDoubleDigits(counterSec)})\r`
    }, 1000)

    if (finalize)
        // Finalize applying a random beacon.
        await zKey.beacon(lastZkey, newZkey, name, entropyOrBeacon, numIterationsExp, logger)
    // Compute the next contribution.
    else await zKey.contribute(lastZkey, newZkey, name, entropyOrBeacon, logger)

    // nb. workaround to logger descriptor close.
    await sleep(1000)

    spinner.stop()
    clearInterval(interval)
}

/**
 * Create a custom logger.
 * @dev useful for keeping track of `info` logs from snarkjs and use them to generate the contribution transcript.
 * @param transcriptFilename <string> - logger output file.
 * @returns <Logger>
 */
export const getTranscriptLogger = (transcriptFilename: string): Logger =>
    // Create a custom logger.
    winston.createLogger({
        level: "info",
        format: winston.format.printf((log) => log.message),
        transports: [
            // Write all logs with importance level of `info` to `transcript.json`.
            new winston.transports.File({
                filename: transcriptFilename,
                level: "info"
            })
        ]
    })

/**
 * Make a progress to the next contribution step for the current contributor.
 * @param firebaseFunctions <Functions> - the object containing the firebase functions.
 * @param ceremonyId <string> - the ceremony unique identifier.
 * @param showSpinner <boolean> - true to show a custom spinner on the terminal; otherwise false.
 * @param message <string> - custom message string based on next contribution step value.
 */
export const makeContributionStepProgress = async (
    firebaseFunctions: Functions,
    ceremonyId: string,
    showSpinner: boolean,
    message: string
) => {
    // Custom spinner for visual feedback.
    const spinner: Ora = customSpinner(`Getting ready for ${message} step`, "clock")

    if (showSpinner) spinner.start()

    // Progress to next contribution step.
    await progressToNextContributionStep(firebaseFunctions, ceremonyId)

    if (showSpinner) spinner.stop()
}

/**
 * Generate the public attestation for the contributor.
 * @param ceremonyDoc <FirebaseDocumentInfo> - the ceremony document.
 * @param participantId <string> - the unique identifier of the participant.
 * @param participantData <DocumentData> - the data of the participant document.
 * @param circuits <Array<FirebaseDocumentInfo> - the ceremony circuits documents.
 * @param ghUsername <string> - the Github username of the contributor.
 * @param ghToken <string> - the Github access token of the contributor.
 */
export const generatePublicAttestation = async (
    firestoreDatabase: Firestore,
    ceremonyDoc: FirebaseDocumentInfo,
    participantId: string,
    participantData: DocumentData,
    circuits: Array<FirebaseDocumentInfo>,
    ghUsername: string,
    ghToken: string
): Promise<void> => {
    // Attestation preamble.
    const attestationPreamble = `Hey, I'm ${ghUsername} and I have contributed to the ${ceremonyDoc.data.title} MPC Phase2 Trusted Setup ceremony.\nThe following are my contribution signatures:`

    // Return true and false based on contribution verification.
    const contributionsValidity = await getContributorContributionsVerificationResults(
        firestoreDatabase,
        ceremonyDoc.id,
        participantId,
        circuits,
        false
    )
    const numberOfValidContributions = contributionsValidity.filter(Boolean).length

    console.log(
        `\nCongrats, you have successfully contributed to ${theme.magenta(
            theme.bold(numberOfValidContributions)
        )} out of ${theme.magenta(theme.bold(circuits.length))} circuits ${emojis.tada}`
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

    process.stdout.write(`\n`)

    const spinner = customSpinner("Uploading public attestation...", "clock")
    spinner.start()

    // Get only valid contribution hashes.
    const attestation = await getValidContributionAttestation(
        firestoreDatabase,
        contributionsValidity,
        circuits,
        participantData!,
        ceremonyDoc.id,
        participantId,
        attestationPreamble,
        false
    )

    writeFile(`${paths.attestationPath}/${ceremonyDoc.data.prefix}_attestation.log`, Buffer.from(attestation))
    await sleep(1000)

    // TODO: If fails for permissions problems, ask to do manually.
    const gistUrl = await publishGist(ghToken, attestation, ceremonyDoc.data.prefix, ceremonyDoc.data.title)

    spinner.succeed(
        `Public attestation successfully published as Github Gist at this link ${theme.bold(theme.underlined(gistUrl))}`
    )

    // Attestation link via Twitter.
    const attestationTweet = `https://twitter.com/intent/tweet?text=I%20contributed%20to%20the%20${ceremonyDoc.data.title}%20Phase%202%20Trusted%20Setup%20ceremony!%20You%20can%20contribute%20here:%20https://github.com/quadratic-funding/mpc-phase2-suite%20You%20can%20view%20my%20attestation%20here:%20${gistUrl}%20#Ethereum%20#ZKP`

    console.log(
        `\nWe appreciate your contribution to preserving the ${ceremonyDoc.data.title} security! ${
            emojis.key
        }  You can tweet about your participation if you'd like (click on the link below ${
            emojis.pointDown
        }) \n\n${theme.underlined(attestationTweet)}`
    )

    await open(attestationTweet)
}

/**
 * Download a local copy of the zkey.
 * @param firebaseFunctions <Functions> - the firebase cloud functions
 * @param bucketName <string> - the name of the AWS S3 bucket.
 * @param objectKey <string> - the identifier of the object (storage path).
 * @param localPath <string> - the path where the file will be written.
 * @param showSpinner <boolean> - true to show a custom spinner on the terminal; otherwise false.
 */
export const downloadContribution = async (
    firebaseFunctions: Functions,
    bucketName: string,
    objectKey: string,
    localPath: string,
    showSpinner: boolean
) => {
    // Custom spinner for visual feedback.
    const spinner: Ora = customSpinner(`Downloading contribution...`, "clock")

    if (showSpinner) spinner.start()

    // Download from storage.
    await downloadLocalFileFromBucket(firebaseFunctions, bucketName, objectKey, localPath)

    if (showSpinner) spinner.stop()
}

/**
 * Upload the new zkey to the storage.
 * @param storagePath <string> - the Storage path where the zkey will be stored.
 * @param localPath <string> - the local path where the zkey is stored.
 * @param showSpinner <boolean> - true to show a custom spinner on the terminal; otherwise false.
 */
// @todo why is this not used?
export const uploadContribution = async (
    firebaseStorage: FirebaseStorage,
    storagePath: string,
    localPath: string,
    showSpinner: boolean
) => {
    // Custom spinner for visual feedback.
    const spinner = customSpinner("Storing your contribution...", "clock")
    if (showSpinner) spinner.start()

    // Upload to storage.
    await uploadFileToStorage(firebaseStorage, localPath, storagePath)

    if (showSpinner) spinner.stop()
}

/**
 * Compute a new Groth16 contribution verification.
 * @param ceremony <FirebaseDocumentInfo> - the ceremony document.
 * @param circuit <FirebaseDocumentInfo> - the circuit document.
 * @param ghUsername <string> - the Github username of the user.
 * @param avgVerifyCloudFunctionTime <number> - the average verify Cloud Function execution time in milliseconds.
 * @param firebaseFunctions <Functions> - the object containing the firebase functions.
 * @returns <Promise<VerifyContributionComputation>>
 */
export const computeVerification = async (
    ceremony: FirebaseDocumentInfo,
    circuit: FirebaseDocumentInfo,
    ghUsername: string,
    avgVerifyCloudFunctionTime: number,
    firebaseFunctions: Functions
): Promise<VerifyContributionComputation> => {
    // Format average verification time.
    const { seconds, minutes, hours } = getSecondsMinutesHoursFromMillis(avgVerifyCloudFunctionTime)

    // Custom spinner for visual feedback.
    const spinner = customSpinner(
        `Verifying your contribution... ${
            avgVerifyCloudFunctionTime > 0
                ? `(est. time ${theme.bold(
                      `${convertToDoubleDigits(hours)}:${convertToDoubleDigits(minutes)}:${convertToDoubleDigits(
                          seconds
                      )}`
                  )})`
                : ``
        }\n`,
        "clock"
    )

    spinner.start()

    if (!process.env.CONFIG_CEREMONY_BUCKET_POSTFIX || !process.env.FIREBASE_CF_URL_VERIFY_CONTRIBUTION!)
        showError(GENERIC_ERRORS.GENERIC_NOT_CONFIGURED_PROPERLY, true)

    const data = await verifyContribution(
        firebaseFunctions,
        process.env.FIREBASE_CF_URL_VERIFY_CONTRIBUTION!,
        ceremony.id,
        circuit.id,
        ghUsername,
        getBucketName(ceremony.data.prefix, process.env.CONFIG_CEREMONY_BUCKET_POSTFIX!)
    )

    spinner.stop()

    if (!data) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

    return {
        valid: data.valid,
        verificationComputationTime: data.verificationComputationTime,
        verifyCloudFunctionTime: data.verifyCloudFunctionTime,
        fullContributionTime: data.fullContributionTime
    }
}

/**
 * Compute a new contribution for the participant.
 * @param ceremony <FirebaseDocumentInfo> - the ceremony document.
 * @param circuit <FirebaseDocumentInfo> - the circuit document.
 * @param entropyOrBeacon <any> - the entropy/beacon for the contribution.
 * @param ghUsername <string> - the Github username of the user.
 * @param finalize <boolean> - true if the contribution finalize the ceremony; otherwise false.
 * @param firebaseFunctions <Functions> - the object containing the firebase functions.
 * @param newParticipantData <DocumentData> - the object containing the participant data.
 * @returns <Promise<string>> - new updated attestation file.
 */
export const makeContribution = async (
    ceremony: FirebaseDocumentInfo,
    circuit: FirebaseDocumentInfo,
    entropyOrBeacon: any,
    ghUsername: string,
    finalize: boolean,
    firebaseFunctions: Functions,
    newParticipantData?: DocumentData
): Promise<void> => {
    // Extract data from circuit.
    const currentProgress = circuit.data.waitingQueue.completedContributions
    const { avgTimings } = circuit.data

    // Compute zkey indexes.
    const currentZkeyIndex = formatZkeyIndex(currentProgress)
    const nextZkeyIndex = formatZkeyIndex(currentProgress + 1)

    // Paths config.
    const transcriptsPath = finalize ? paths.finalTranscriptsPath : paths.contributionTranscriptsPath
    const contributionsPath = finalize ? paths.finalZkeysPath : paths.contributionsPath

    // Get custom transcript logger.
    const contributionTranscriptLocalPath = `${transcriptsPath}/${circuit.data.prefix}_${
        finalize ? `${ghUsername}_final` : nextZkeyIndex
    }.log`
    const transcriptLogger = getTranscriptLogger(contributionTranscriptLocalPath)

    if (!process.env.CONFIG_CEREMONY_BUCKET_POSTFIX!) showError(GENERIC_ERRORS.GENERIC_NOT_CONFIGURED_PROPERLY, true)

    const bucketName = getBucketName(ceremony.data.prefix, process.env.CONFIG_CEREMONY_BUCKET_POSTFIX!)

    // Write first message.
    transcriptLogger.info(
        `${finalize ? `Final` : `Contribution`} transcript for ${circuit.data.prefix} phase 2 contribution.\n${
            finalize ? `Coordinator: ${ghUsername}` : `Contributor # ${Number(nextZkeyIndex)}`
        } (${ghUsername})\n`
    )

    console.log(
        `${theme.bold(`\n- Circuit # ${theme.magenta(`${circuit.data.sequencePosition}`)}`)} (Contribution Steps)`
    )

    if (
        finalize ||
        (!!newParticipantData?.contributionStep &&
            newParticipantData?.contributionStep === ParticipantContributionStep.DOWNLOADING)
    ) {
        const spinner = customSpinner(`Preparing for download...`, `clock`)
        spinner.start()

        // 1. Download last contribution.
        const storagePath = `${collections.circuits}/${circuit.data.prefix}/${collections.contributions}/${circuit.data.prefix}_${currentZkeyIndex}.zkey`
        const localPath = `${contributionsPath}/${circuit.data.prefix}_${currentZkeyIndex}.zkey`

        spinner.stop()

        await downloadContribution(firebaseFunctions, bucketName, storagePath, localPath, false)

        console.log(`${symbols.success} Contribution ${theme.bold(`#${currentZkeyIndex}`)} correctly downloaded`)

        // Make the step if not finalizing.
        if (!finalize) await makeContributionStepProgress(firebaseFunctions!, ceremony.id, true, "computation")
    } else console.log(`${symbols.success} Contribution ${theme.bold(`#${currentZkeyIndex}`)} already downloaded`)

    if (
        finalize ||
        (!!newParticipantData?.contributionStep &&
            newParticipantData?.contributionStep === ParticipantContributionStep.DOWNLOADING) ||
        newParticipantData?.contributionStep === ParticipantContributionStep.COMPUTING
    ) {
        const contributionComputationTimer = new Timer({ label: "contributionComputation" }) // Compute time (only for statistics).

        // 2.A Compute the new contribution.
        contributionComputationTimer.start()

        await computeContribution(
            `${contributionsPath}/${circuit.data.prefix}_${currentZkeyIndex}.zkey`,
            `${contributionsPath}/${circuit.data.prefix}_${finalize ? `final` : nextZkeyIndex}.zkey`,
            ghUsername,
            entropyOrBeacon,
            transcriptLogger,
            finalize,
            avgTimings.contributionComputation
        )

        contributionComputationTimer.stop()

        const contributionComputationTime = contributionComputationTimer.ms()

        const spinner = customSpinner(`Storing contribution time and hash...`, `clock`)
        spinner.start()

        // nb. workaround for file descriptor close.
        await sleep(2000)

        // 2.B Generate attestation from single contribution transcripts from each circuit (queue this contribution).
        const transcript = readFile(contributionTranscriptLocalPath)

        const matchContributionHash = transcript.match(/Contribution.+Hash.+\n\t\t.+\n\t\t.+\n.+\n\t\t.+\n/)

        if (!matchContributionHash) showError(GENERIC_ERRORS.GENERIC_CONTRIBUTION_HASH_INVALID, true)

        const contributionHash = matchContributionHash?.at(0)?.replace("\n\t\t", "")!

        await permanentlyStoreCurrentContributionTimeAndHash(
            firebaseFunctions,
            ceremony.id,
            contributionComputationTime,
            contributionHash
        )

        const {
            seconds: computationSeconds,
            minutes: computationMinutes,
            hours: computationHours
        } = getSecondsMinutesHoursFromMillis(contributionComputationTime)

        spinner.succeed(
            `${
                finalize ? "Contribution" : `Contribution ${theme.bold(`#${nextZkeyIndex}`)}`
            } computation took ${theme.bold(
                `${convertToDoubleDigits(computationHours)}:${convertToDoubleDigits(
                    computationMinutes
                )}:${convertToDoubleDigits(computationSeconds)}`
            )}`
        )

        // Make the step if not finalizing.
        if (!finalize) await makeContributionStepProgress(firebaseFunctions!, ceremony.id, true, "upload")
    } else console.log(`${symbols.success} Contribution ${theme.bold(`#${nextZkeyIndex}`)} already computed`)

    if (
        finalize ||
        (!!newParticipantData?.contributionStep &&
            newParticipantData?.contributionStep === ParticipantContributionStep.DOWNLOADING) ||
        newParticipantData?.contributionStep === ParticipantContributionStep.COMPUTING ||
        newParticipantData?.contributionStep === ParticipantContributionStep.UPLOADING
    ) {
        // 3. Store file.
        const storagePath = `${collections.circuits}/${circuit.data.prefix}/${collections.contributions}/${
            circuit.data.prefix
        }_${finalize ? `final` : nextZkeyIndex}.zkey`
        const localPath = `${contributionsPath}/${circuit.data.prefix}_${finalize ? `final` : nextZkeyIndex}.zkey`

        const spinner = customSpinner(`Storing contribution ${theme.bold(`#${nextZkeyIndex}`)} to storage...`, `clock`)
        spinner.start()

        // Upload.
        if (!finalize) {
            await multiPartUpload(
                firebaseFunctions,
                bucketName,
                storagePath,
                localPath,
                process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "50",
                process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS || 7200,
                ceremony.id,
                newParticipantData?.tempContributionData
            )
        } else
            await multiPartUpload(
                firebaseFunctions,
                bucketName,
                storagePath,
                localPath,
                process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "50",
                process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS || 7200
            )

        spinner.succeed(
            `${
                finalize ? `Contribution` : `Contribution ${theme.bold(`#${nextZkeyIndex}`)}`
            } correctly saved on storage`
        )

        // Make the step if not finalizing.
        if (!finalize) await makeContributionStepProgress(firebaseFunctions!, ceremony.id, true, "verification")
    } else
        console.log(
            `${symbols.success} ${
                finalize ? `Contribution` : `Contribution ${theme.bold(`#${nextZkeyIndex}`)}`
            } already saved on storage`
        )

    if (
        finalize ||
        (!!newParticipantData?.contributionStep &&
            newParticipantData?.contributionStep === ParticipantContributionStep.DOWNLOADING) ||
        newParticipantData?.contributionStep === ParticipantContributionStep.COMPUTING ||
        newParticipantData?.contributionStep === ParticipantContributionStep.UPLOADING ||
        newParticipantData?.contributionStep === ParticipantContributionStep.VERIFYING
    ) {
        // 5. Verify contribution.
        const { valid, verifyCloudFunctionTime, fullContributionTime } = await computeVerification(
            ceremony,
            circuit,
            ghUsername,
            avgTimings.verifyCloudFunction,
            firebaseFunctions
        )

        const {
            seconds: verificationSeconds,
            minutes: verificationMinutes,
            hours: verificationHours
        } = getSecondsMinutesHoursFromMillis(verifyCloudFunctionTime)

        console.log(
            `${valid ? symbols.success : symbols.error} ${
                finalize ? `Contribution` : `Contribution ${theme.bold(`#${nextZkeyIndex}`)}`
            } ${valid ? `is ${theme.bold("VALID")}` : `is ${theme.bold("INVALID")}`}`
        )
        console.log(
            `${symbols.success} ${
                finalize ? `Contribution` : `Contribution ${theme.bold(`#${nextZkeyIndex}`)}`
            } verification took ${theme.bold(
                `${convertToDoubleDigits(verificationHours)}:${convertToDoubleDigits(
                    verificationMinutes
                )}:${convertToDoubleDigits(verificationSeconds)}`
            )}`
        )

        const {
            seconds: contributionSeconds,
            minutes: contributionMinutes,
            hours: contributionHours
        } = getSecondsMinutesHoursFromMillis(fullContributionTime + verifyCloudFunctionTime)
        console.log(
            `${symbols.info} Your contribution took ${theme.bold(
                `${convertToDoubleDigits(contributionHours)}:${convertToDoubleDigits(
                    contributionMinutes
                )}:${convertToDoubleDigits(contributionSeconds)}`
            )}`
        )
    }
}
