import { request } from "@octokit/request"
import { DocumentData, DocumentSnapshot, Firestore, onSnapshot, Timestamp } from "firebase/firestore"
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
import { GithubAuthProvider, OAuthCredential } from "firebase/auth"
import { SingleBar, Presets } from "cli-progress"
import { createWriteStream } from "fs"
import fetch from "@adobe/node-fetch-retry"
import {
    generateGetObjectPreSignedUrl,
    convertToGB,
    getCurrentActiveParticipantTimeout,
    numExpIterations,
    progressToNextContributionStep,
    getContributorContributionsVerificationResults,
    getValidContributionAttestation,
    uploadFileToStorage,
    verifyContribution,
    getBucketName,
    formatZkeyIndex,
    getZkeyStorageFilePath,
    permanentlyStoreCurrentContributionTimeAndHash,
    multiPartUpload,
    getZkeysSpaceRequirementsForContributionInGB,
    makeProgressToNextContribution,
    resumeContributionAfterTimeoutExpiration,
    getDocumentById,
    commonTerms,
    getCurrentContributorContribution
} from "@zkmpc/actions/src"
import { FirebaseDocumentInfo } from "@zkmpc/actions/src/types"
import { ParticipantStatus, ParticipantContributionStep } from "@zkmpc/actions/src/types/enums"
import { GENERIC_ERRORS, GITHUB_ERRORS, showError } from "./errors"
import theme from "./theme"
import {
    getAttestationLocalFilePath,
    getContributionLocalFilePath,
    getFinalTranscriptLocalFilePath,
    getFinalZkeyLocalFilePath,
    getTranscriptLocalFilePath
} from "./localConfigs"
import { writeFile, readFile } from "./files"
import { askForConfirmation } from "./prompts"
import { ProgressBarType, Timing, VerifyContributionComputation } from "../../types"

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
 * Create a custom logger to write logs on a local file.
 * @param filename <string> - the name of the output file (where the logs are going to be written).
 * @param level <winston.LoggerOptions["level"]> - the option for the logger level (e.g., info, error).
 * @returns <Logger> - a customized winston logger for files.
 */
export const createCustomLoggerForFile = (filename: string, level: winston.LoggerOptions["level"] = "info"): Logger =>
    winston.createLogger({
        level,
        transports: new winston.transports.File({
            filename,
            format: winston.format.printf((log) => log.message),
            level
        })
    })

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
 * Return a string with double digits if the provided input is one digit only.
 * @param in <number> - the input number to be converted.
 * @returns <string> - the two digits stringified number derived from the conversion.
 */
export const convertToDoubleDigits = (amount: number): string => (amount < 10 ? `0${amount}` : amount.toString())

/**
 * Custom sleeper.
 * @dev to be used in combination with loggers and for workarounds where listeners cannot help.
 * @param ms <number> - sleep amount in milliseconds
 * @returns <Promise<any>>
 */
export const sleep = (ms: number): Promise<any> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Return a simple loader to simulate loading task or describe an asynchronous task.
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
 * Return a custom progress bar.
 * @param type <ProgressBarType> - the type of the progress bar.
 * @returns <SingleBar> - a new custom (single) progress bar.
 */
const customProgressBar = (type: ProgressBarType): SingleBar => {
    // Formats.
    const uploadFormat = `${theme.emojis.arrowUp}  Uploading [${theme.colors.magenta(
        "{bar}"
    )}] {percentage}% | {value}/{total} Chunks`
    const downloadFormat = `${theme.emojis.arrowDown}  Downloading [${theme.colors.magenta(
        "{bar}"
    )}] {percentage}% | {value}/{total} GB`

    // Define a progress bar showing percentage of completion and chunks downloaded/uploaded.
    return new SingleBar(
        {
            format: type === ProgressBarType.DOWNLOAD ? downloadFormat : uploadFormat,
            hideCursor: true,
            clearOnComplete: true
        },
        Presets.legacy
    )
}

/**
 * Download locally a specified file from the given bucket.
 * @param firebaseFunctions <Functions> - the firebase cloud functions.
 * @param bucketName <string> - the name of the AWS S3 bucket.
 * @param objectKey <string> - the identifier of the object (storage path).
 * @param localPath <string> - the path where the file will be written.
 * @return <Promise<void>>
 */
export const downloadLocalFileFromBucket = async (
    firebaseFunctions: Functions,
    bucketName: string,
    objectKey: string,
    localPath: string
): Promise<void> => {
    // Call generateGetObjectPreSignedUrl() Cloud Function.
    const preSignedUrl = await generateGetObjectPreSignedUrl(firebaseFunctions, bucketName, objectKey)

    // Get request.
    const getResponse = await fetch(preSignedUrl)
    if (!getResponse.ok) showError(`${GENERIC_ERRORS.GENERIC_FILE_ERROR} - ${getResponse.statusText}`, true)

    const contentLength = Number(getResponse.headers.get(`content-length`))
    const contentLengthInGB = convertToGB(contentLength, true)

    // Create a new write stream.
    const writeStream = createWriteStream(localPath)

    // Define a custom progress bar starting from last updated chunk.
    const progressBar = customProgressBar(ProgressBarType.DOWNLOAD)

    // Progress bar step size.
    const progressBarStepSize = contentLengthInGB / 100

    let writtenData = 0
    let nextStepSize = progressBarStepSize

    // Init the progress bar.
    progressBar.start(contentLengthInGB < 0.01 ? 0.01 : Number(contentLengthInGB.toFixed(2)), 0)

    // Write chunk by chunk.
    for await (const chunk of getResponse.body) {
        // Write.
        writeStream.write(chunk)

        // Update.
        writtenData += chunk.length

        // Check if the progress bar must advance.
        while (convertToGB(writtenData, true) >= nextStepSize) {
            // Update.
            nextStepSize += progressBarStepSize

            // Increment bar.
            progressBar.update(contentLengthInGB < 0.01 ? 0.01 : parseFloat(nextStepSize.toFixed(2)).valueOf())
        }
    }

    progressBar.stop()
}

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
    console.log(`\nSee you, ${theme.text.bold(`@${ghUsername}`)} ${theme.emojis.wave}`)

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
                    `${theme.symbols.warning} Expires in ${theme.text.bold(
                        theme.colors.magenta(`00:${Math.floor(durationInSeconds / 60)}:${seconds}`)
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
            `${message} (${remainingTime < 0 ? theme.text.bold(`-`) : ``}${convertToDoubleDigits(
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
        if (!isContributing) console.log(theme.text.bold(`\n- Circuit # ${theme.colors.magenta(contributionProgress)}`))
        else process.stdout.write(`\n`)

        console.log(
            `${theme.symbols.error} ${
                isContributing ? `You have been timedout while contributing` : `Timeout still in progress.`
            }\n\n${
                theme.symbols.warning
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
            `${theme.symbols.info} You can retry your contribution in ${theme.text.bold(
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
            ? `(ETA ${theme.text.bold(
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
        await zKey.beacon(lastZkey, newZkey, name, entropyOrBeacon, numExpIterations, logger)
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
        `\nCongrats, you have successfully contributed to ${theme.colors.magenta(
            theme.text.bold(numberOfValidContributions)
        )} out of ${theme.colors.magenta(theme.text.bold(circuits.length))} circuits ${theme.emojis.tada}`
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

    writeFile(getAttestationLocalFilePath(`${ceremonyDoc.data.prefix}_attestation.log`), Buffer.from(attestation))
    await sleep(1000)

    // TODO: If fails for permissions problems, ask to do manually.
    const gistUrl = await publishGist(ghToken, attestation, ceremonyDoc.data.prefix, ceremonyDoc.data.title)

    spinner.succeed(
        `Public attestation successfully published as Github Gist at this link ${theme.text.bold(
            theme.text.underlined(gistUrl)
        )}`
    )

    // Attestation link via Twitter.
    const attestationTweet = `https://twitter.com/intent/tweet?text=I%20contributed%20to%20the%20${ceremonyDoc.data.title}%20Phase%202%20Trusted%20Setup%20ceremony!%20You%20can%20contribute%20here:%20https://github.com/quadratic-funding/mpc-phase2-suite%20You%20can%20view%20my%20attestation%20here:%20${gistUrl}%20#Ethereum%20#ZKP`

    console.log(
        `\nWe appreciate your contribution to preserving the ${ceremonyDoc.data.title} security! ${
            theme.emojis.key
        }  You can tweet about your participation if you'd like (click on the link below ${
            theme.emojis.pointDown
        }) \n\n${theme.text.underlined(attestationTweet)}`
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
                ? `(est. time ${theme.text.bold(
                      `${convertToDoubleDigits(hours)}:${convertToDoubleDigits(minutes)}:${convertToDoubleDigits(
                          seconds
                      )}`
                  )})`
                : ``
        }\n`,
        "clock"
    )

    spinner.start()

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

    // Get custom transcript logger.
    const contributionTranscriptLocalPath = finalize
        ? getFinalTranscriptLocalFilePath(`${circuit.data.prefix}_${ghUsername}_final.log`)
        : getTranscriptLocalFilePath(`${circuit.data.prefix}_${nextZkeyIndex}.log`)

    const transcriptLogger = getTranscriptLogger(contributionTranscriptLocalPath)

    const bucketName = getBucketName(ceremony.data.prefix, process.env.CONFIG_CEREMONY_BUCKET_POSTFIX!)

    // Write first message.
    transcriptLogger.info(
        `${finalize ? `Final` : `Contribution`} transcript for ${circuit.data.prefix} phase 2 contribution.\n${
            finalize ? `Coordinator: ${ghUsername}` : `Contributor # ${Number(nextZkeyIndex)}`
        } (${ghUsername})\n`
    )

    console.log(
        `${theme.text.bold(
            `\n- Circuit # ${theme.colors.magenta(`${circuit.data.sequencePosition}`)}`
        )} (Contribution Steps)`
    )

    if (
        finalize ||
        (!!newParticipantData?.contributionStep &&
            newParticipantData?.contributionStep === ParticipantContributionStep.DOWNLOADING)
    ) {
        const spinner = customSpinner(`Preparing for download...`, `clock`)
        spinner.start()

        // 1. Download last contribution.
        const storagePath = getZkeyStorageFilePath(
            circuit.data.prefix,
            `${circuit.data.prefix}_${currentZkeyIndex}.zkey`
        )
        const localPath = finalize
            ? getFinalZkeyLocalFilePath(`${circuit.data.prefix}_${currentZkeyIndex}.zkey`)
            : getContributionLocalFilePath(`${circuit.data.prefix}_${currentZkeyIndex}.zkey`)

        spinner.stop()

        await downloadContribution(firebaseFunctions, bucketName, storagePath, localPath, false)

        console.log(
            `${theme.symbols.success} Contribution ${theme.text.bold(`#${currentZkeyIndex}`)} correctly downloaded`
        )

        // Make the step if not finalizing.
        if (!finalize) await makeContributionStepProgress(firebaseFunctions!, ceremony.id, true, "computation")
    } else
        console.log(
            `${theme.symbols.success} Contribution ${theme.text.bold(`#${currentZkeyIndex}`)} already downloaded`
        )

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
            finalize
                ? getFinalZkeyLocalFilePath(`${circuit.data.prefix}_${currentZkeyIndex}.zkey`)
                : getContributionLocalFilePath(`${circuit.data.prefix}_${currentZkeyIndex}.zkey`),
            finalize
                ? getFinalZkeyLocalFilePath(`${circuit.data.prefix}_final.zkey`)
                : getContributionLocalFilePath(`${circuit.data.prefix}_${nextZkeyIndex}.zkey`),
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
                finalize ? "Contribution" : `Contribution ${theme.text.bold(`#${nextZkeyIndex}`)}`
            } computation took ${theme.text.bold(
                `${convertToDoubleDigits(computationHours)}:${convertToDoubleDigits(
                    computationMinutes
                )}:${convertToDoubleDigits(computationSeconds)}`
            )}`
        )

        // Make the step if not finalizing.
        if (!finalize) await makeContributionStepProgress(firebaseFunctions!, ceremony.id, true, "upload")
    } else console.log(`${theme.symbols.success} Contribution ${theme.text.bold(`#${nextZkeyIndex}`)} already computed`)

    if (
        finalize ||
        (!!newParticipantData?.contributionStep &&
            newParticipantData?.contributionStep === ParticipantContributionStep.DOWNLOADING) ||
        newParticipantData?.contributionStep === ParticipantContributionStep.COMPUTING ||
        newParticipantData?.contributionStep === ParticipantContributionStep.UPLOADING
    ) {
        // 3. Store file.
        const storagePath = getZkeyStorageFilePath(
            circuit.data.prefix,
            finalize ? `${circuit.data.prefix}_final.zkey` : `${circuit.data.prefix}_${nextZkeyIndex}.zkey`
        )
        const localPath = finalize
            ? getFinalZkeyLocalFilePath(`${circuit.data.prefix}_final.zkey`)
            : getContributionLocalFilePath(`${circuit.data.prefix}_${nextZkeyIndex}.zkey`)

        const spinner = customSpinner(
            `Storing contribution ${theme.text.bold(`#${nextZkeyIndex}`)} to storage...`,
            `clock`
        )
        spinner.start()

        // Upload.
        if (!finalize) {
            await multiPartUpload(
                firebaseFunctions,
                bucketName,
                storagePath,
                localPath,
                String(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB),
                Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS),
                ceremony.id,
                newParticipantData?.tempContributionData
            )
        } else
            await multiPartUpload(
                firebaseFunctions,
                bucketName,
                storagePath,
                localPath,
                String(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB),
                Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS)
            )

        spinner.succeed(
            `${
                finalize ? `Contribution` : `Contribution ${theme.text.bold(`#${nextZkeyIndex}`)}`
            } correctly saved on storage`
        )

        // Make the step if not finalizing.
        if (!finalize) await makeContributionStepProgress(firebaseFunctions!, ceremony.id, true, "verification")
    } else
        console.log(
            `${theme.symbols.success} ${
                finalize ? `Contribution` : `Contribution ${theme.text.bold(`#${nextZkeyIndex}`)}`
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
            `${valid ? theme.symbols.success : theme.symbols.error} ${
                finalize ? `Contribution` : `Contribution ${theme.text.bold(`#${nextZkeyIndex}`)}`
            } ${valid ? `is ${theme.text.bold("VALID")}` : `is ${theme.text.bold("INVALID")}`}`
        )
        console.log(
            `${theme.symbols.success} ${
                finalize ? `Contribution` : `Contribution ${theme.text.bold(`#${nextZkeyIndex}`)}`
            } verification took ${theme.text.bold(
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
            `${theme.symbols.info} Your contribution took ${theme.text.bold(
                `${convertToDoubleDigits(contributionHours)}:${convertToDoubleDigits(
                    contributionMinutes
                )}:${convertToDoubleDigits(contributionSeconds)}`
            )}`
        )
    }
}

/**
 * Return the available disk space of the current contributor in GB.
 * @returns <number>
 */
export const getContributorAvailableDiskSpaceInGB = (): number =>
    convertToGB(getParticipantCurrentDiskAvailableSpace(), false)

/**
 * Check if the contributor has enough space before starting the contribution for next circuit.
 * @param functions <Functions> - the cloud functions.
 * @param nextCircuit <FirebaseDocumentInfo> - the circuit document.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @return <Promise<void>>
 */
export const handleDiskSpaceRequirementForNextContribution = async (
    functions: Functions,
    nextCircuit: FirebaseDocumentInfo,
    ceremonyId: string,
    functionName: string = "makeProgressToNextContribution"
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
        console.log(theme.text.bold(`- Circuit # ${theme.colors.magenta(`${sequencePosition}`)}`))

        console.log(
            `${theme.symbols.error} You do not have enough memory to make a contribution (Required ${
                zKeysSpaceRequirementsInGB < 0.01
                    ? theme.text.bold(`< 0.01`)
                    : theme.text.bold(zKeysSpaceRequirementsInGB)
            } GB (available ${
                availableDiskSpaceInGB > 0 ? theme.text.bold(availableDiskSpaceInGB.toFixed(2)) : theme.text.bold(0)
            } GB)\n`
        )

        if (sequencePosition > 1) {
            // The user has computed at least one valid contribution. Therefore, can choose if free up memory and contrinue with next contribution or generate the final attestation.
            console.log(
                `${theme.symbols.info} You have time until ceremony ends to free up your memory, complete contributions and publish the attestation`
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
            `${theme.symbols.success} You have enough memory for contributing to ${theme.text.bold(
                `Circuit ${theme.colors.magenta(sequencePosition)}`
            )}`
        )

        const spinner = customSpinner(
            `Joining ${theme.text.bold(`Circuit ${theme.colors.magenta(sequencePosition)}`)} waiting queue...`,
            `clock`
        )
        spinner.start()

        if (functionName === "makeProgressToNextContribution")
            await makeProgressToNextContribution(functions, ceremonyId)
        else await resumeContributionAfterTimeoutExpiration(functions, ceremonyId)

        spinner.succeed(
            `All set for contribution to ${theme.text.bold(`Circuit ${theme.colors.magenta(sequencePosition)}`)}`
        )

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
export const getParticipantPositionInQueue = (contributors: Array<string>, participantId: string): number =>
    contributors.indexOf(participantId) + 1

/**
 * Listen to circuit document changes and reacts in realtime.
 * @param firestoreDatabase <Firestore> - the Firestore db.
 * @param participantId <string> - the unique identifier of the contributor.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param circuit <FirebaseDocumentInfo> - the document information about the current circuit.
 */
export const listenToCircuitChanges = (
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
            `${commonTerms.collections.ceremonies.name}/${ceremonyId}/${commonTerms.collections.participants.name}`,
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
                `\n${theme.symbols.success} Your turn has come ${theme.emojis.tada}\n${theme.symbols.info} Your contribution will begin soon`
            )
            unsubscriberForCircuitDocument()
        } else {
            // Position and time.
            console.log(
                `\n${theme.symbols.info} ${
                    newParticipantPositionInQueue === 2
                        ? `You are the next contributor`
                        : `Your position in the waiting queue is ${theme.text.bold(
                              theme.colors.magenta(newParticipantPositionInQueue - 1)
                          )}`
                } (${
                    newEstimatedWaitingTime > 0
                        ? `${theme.text.bold(
                              `${convertToDoubleDigits(estHours)}:${convertToDoubleDigits(
                                  estMinutes
                              )}:${convertToDoubleDigits(estSeconds)}`
                          )} left before your turn)`
                        : `no time estimation)`
                }`
            )

            // Participant data.
            console.log(` - Contributor # ${theme.text.bold(theme.colors.magenta(completedContributions + 1))}`)

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
                            const message = `   ${theme.symbols.info} Downloading contribution ${theme.text.bold(
                                `#${currentZkeyIndex}`
                            )}`
                            interval = simpleCountdown(remainingTime, message)

                            break
                        }
                        case ParticipantContributionStep.COMPUTING: {
                            process.stdout.write(
                                `   ${theme.symbols.success} Contribution ${theme.text.bold(
                                    `#${currentZkeyIndex}`
                                )} correctly downloaded\n`
                            )

                            const message = `   ${theme.symbols.info} Computing contribution ${theme.text.bold(
                                `#${nextZkeyIndex}`
                            )}`
                            interval = simpleCountdown(remainingTime, message)

                            break
                        }
                        case ParticipantContributionStep.UPLOADING: {
                            process.stdout.write(
                                `   ${theme.symbols.success} Contribution ${theme.text.bold(
                                    `#${nextZkeyIndex}`
                                )} successfully computed\n`
                            )

                            const message = `   ${theme.symbols.info} Uploading contribution ${theme.text.bold(
                                `#${nextZkeyIndex}`
                            )}`
                            interval = simpleCountdown(remainingTime, message)

                            break
                        }
                        case ParticipantContributionStep.VERIFYING: {
                            process.stdout.write(
                                `   ${theme.symbols.success} Contribution ${theme.text.bold(
                                    `#${nextZkeyIndex}`
                                )} successfully uploaded\n`
                            )

                            const message = `   ${theme.symbols.info} Contribution verification ${theme.text.bold(
                                `#${nextZkeyIndex}`
                            )}`
                            interval = simpleCountdown(remainingTime, message)

                            break
                        }
                        case ParticipantContributionStep.COMPLETED: {
                            process.stdout.write(
                                `   ${theme.symbols.success} Contribution ${theme.text.bold(
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
                                process.stdout.write(
                                    `   ${theme.symbols.error} We could not recover the contribution data`
                                )
                            else {
                                const contribution = currentContributorContributions.at(0)

                                const data = contribution?.data

                                console.log(
                                    `   ${
                                        data?.valid ? theme.symbols.success : theme.symbols.error
                                    } Contribution ${theme.text.bold(`#${nextZkeyIndex}`)} is ${
                                        data?.valid ? `VALID` : `INVALID`
                                    }`
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
