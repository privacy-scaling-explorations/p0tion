import { request } from "@octokit/request"
import { DocumentData, Firestore } from "firebase/firestore"
import ora, { Ora } from "ora"
import { zKey } from "snarkjs"
import { Functions } from "firebase/functions"
import { Timer } from "timer-node"
import { getDiskInfoSync } from "node-disk-info"
import Drive from "node-disk-info/dist/classes/drive"
import dotenv from "dotenv"
import { GithubAuthProvider, OAuthCredential } from "firebase/auth"
import { SingleBar, Presets } from "cli-progress"
import { createWriteStream } from "fs"
import fetch from "@adobe/node-fetch-retry"
import {
    generateGetObjectPreSignedUrl,
    numExpIterations,
    progressToNextContributionStep,
    verifyContribution,
    getBucketName,
    formatZkeyIndex,
    getZkeyStorageFilePath,
    permanentlyStoreCurrentContributionTimeAndHash,
    multiPartUpload,
    convertBytesOrKbToGb,
    getDocumentById,
    getParticipantsCollectionPath,
    createCustomLoggerForFile,
    commonTerms,
    finalContributionIndex
} from "@zkmpc/actions/src"
import { FirebaseDocumentInfo } from "@zkmpc/actions/src/types"
import { ParticipantContributionStep } from "@zkmpc/actions/src/types/enums"
import { Logger } from "winston"
import { THIRD_PARTY_SERVICES_ERRORS, showError, COMMAND_ERRORS, CORE_SERVICES_ERRORS } from "./errors"
import theme from "./theme"
import {
    getContributionLocalFilePath,
    getFinalTranscriptLocalFilePath,
    getFinalZkeyLocalFilePath,
    getTranscriptLocalFilePath
} from "./localConfigs"
import { readFile } from "./files"
import { GithubGistFile, ProgressBarType, Timing } from "../../types"

dotenv.config()

/**
 * Exchange the Github token for OAuth credential.
 * @param githubToken <string> - the Github token generated through the Device Flow process.
 * @returns <OAuthCredential>
 */
export const exchangeGithubTokenForCredentials = (githubToken: string): OAuthCredential =>
    GithubAuthProvider.credential(githubToken)

/**
 * Get the information associated to the account from which the token has been generated to
 * create a custom unique identifier for the user.
 * @notice the unique identifier has the following form 'handle-identifier'.
 * @param githubToken <string> - the Github token.
 * @returns <Promise<any>> - the Github (provider) unique identifier associated to the user.
 */
export const getGithubProviderUserId = async (githubToken: string): Promise<any> => {
    // Ask for user account public information through Github API.
    const response = await request("GET https://api.github.com/user", {
        headers: {
            authorization: `token ${githubToken}`
        }
    })

    if (response && response.status === 200) return `${response.data.login}-${response.data.id}`

    showError(THIRD_PARTY_SERVICES_ERRORS.GITHUB_GET_GITHUB_ACCOUNT_INFO, true)
}

/**
 * Get the gists associated to the authenticated user account.
 * @param githubToken <string> - the Github token.
 * @param params <Object<number,number>> - the necessary parameters for the request.
 * @returns <Promise<any>> - the Github gists associated with the authenticated user account.
 */
export const getGithubAuthenticatedUserGists = async (
    githubToken: string,
    params: { perPage: number; page: number }
): Promise<any> => {
    // Ask for user account public information through Github API.
    const response = await request("GET https://api.github.com/gists{?per_page,page}", {
        headers: {
            authorization: `token ${githubToken}`
        },
        per_page: params.perPage, // max items per page = 100.
        page: params.page
    })

    if (response && response.status === 200) return response.data

    showError(THIRD_PARTY_SERVICES_ERRORS.GITHUB_GET_GITHUB_ACCOUNT_INFO, true)
}

/**
 * Check whether or not the user has published the gist.
 * @dev gather all the user's gists and check if there is a match with the expected public attestation.
 * @param githubToken <string> - the Github token.
 * @param publicAttestationFilename <string> - the public attestation filename.
 * @returns <Promise<GithubGistFile | undefined>> - return the public attestation gist if and only if has been published.
 */
export const getPublicAttestationGist = async (
    githubToken: string,
    publicAttestationFilename: string
): Promise<GithubGistFile | undefined> => {
    const itemsPerPage = 50 // number of gists to fetch x page.
    let gists: Array<any> = [] // The list of user gists.
    let publishedGist: GithubGistFile | undefined // the published public attestation gist.
    let page = 1 // Page of gists = starts from 1.

    // Get first batch (page) of gists
    let pageGists = await getGithubAuthenticatedUserGists(githubToken, { perPage: itemsPerPage, page })

    // State update.
    gists = gists.concat(pageGists)

    // Keep going until hitting a blank page.
    while (pageGists.length > 0) {
        // Fetch next page.
        page += 1
        pageGists = await getGithubAuthenticatedUserGists(githubToken, { perPage: itemsPerPage, page })

        // State update.
        gists = gists.concat(pageGists)
    }

    // Look for public attestation.
    for (const gist of gists) {
        const numberOfFiles = Object.keys(gist.files).length
        const publicAttestationCandidateFile = Object.values(gist.files)[0] as GithubGistFile

        /// @todo improve check by using expected public attestation content (e.g., hash).
        if (numberOfFiles === 1 && publicAttestationCandidateFile.filename === publicAttestationFilename)
            publishedGist = publicAttestationCandidateFile
    }

    return publishedGist
}

/**
 * Return the Github handle from the provider user id.
 * @notice the provider user identifier must have the following structure 'handle-id'.
 * @param providerUserId <string> - the unique provider user identifier.
 * @returns <string> - the third-party provider handle of the user.
 */
export const getUserHandleFromProviderUserId = (providerUserId: string): string => {
    if (providerUserId.indexOf("-") === -1) showError(THIRD_PARTY_SERVICES_ERRORS.GITHUB_GET_GITHUB_ACCOUNT_INFO, true)

    return providerUserId.split("-")[0]
}

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
 * Simple loader for task simulation.
 * @param loadingText <string> - spinner text while loading.
 * @param spinnerLogo <any> - spinner logo.
 * @param durationInMs <number> - spinner loading duration in ms.
 * @returns <Promise<void>>.
 */
export const simpleLoader = async (loadingText: string, spinnerLogo: any, durationInMs: number): Promise<void> => {
    // Custom spinner (used as loader).
    const loader = customSpinner(loadingText, spinnerLogo)

    loader.start()

    // nb. simulate execution for requested duration.
    await sleep(durationInMs)

    loader.stop()
}

/**
 * Check and return the free root disk space (in KB) for participant machine.
 * @dev this method use the node-disk-info method to retrieve the information about
 * disk availability for the root disk only (i.e., the one mounted in `/`).
 * nb. no other type of data or operation is performed by this methods.
 * @returns <number> - the free root disk space in kB for the participant machine.
 */
export const getParticipantFreeRootDiskSpace = (): number => {
    // Get info about root disk.
    const disks = getDiskInfoSync()
    const root = disks.filter((disk: Drive) => disk.mounted === `/`)

    if (root.length !== 1) showError(COMMAND_ERRORS.COMMAND_CONTRIBUTE_NO_ROOT_DISK_SPACE, true)

    // Return the disk space available in KB.
    return root.at(0)!.available
}

/**
 * Get seconds, minutes, hours and days from milliseconds.
 * @param millis <number> - the amount of milliseconds.
 * @returns <Timing> - a custom object containing the amount of seconds, minutes, hours and days in the provided millis.
 */
export const getSecondsMinutesHoursFromMillis = (millis: number): Timing => {
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
    console.log(`\nSee you, ${theme.text.bold(`@${getUserHandleFromProviderUserId(ghUsername)}`)} ${theme.emojis.wave}`)

    process.exit(0)
}

/**
 * Publish public attestation using Github Gist.
 * @dev the contributor must have agreed to provide 'gist' access during the execution of the 'auth' command.
 * @param accessToken <string> - the contributor access token.
 * @param publicAttestation <string> - the public attestation.
 * @param ceremonyTitle <string> - the ceremony title.
 * @param ceremonyPrefix <string> - the ceremony prefix.
 * @returns <Promise<string>> - the url where the gist has been published.
 */
export const publishGist = async (
    token: string,
    content: string,
    ceremonyTitle: string,
    ceremonyPrefix: string
): Promise<string> => {
    // Make request.
    const response = await request("POST /gists", {
        description: `Attestation for ${ceremonyTitle} MPC Phase 2 Trusted Setup ceremony`,
        public: true,
        files: {
            [`${ceremonyPrefix}_${commonTerms.foldersAndPathsTerms.attestation}.log`]: {
                content
            }
        },
        headers: {
            authorization: `token ${token}`
        }
    })

    if (response.status !== 201 || !response.data.html_url)
        showError(THIRD_PARTY_SERVICES_ERRORS.GITHUB_GIST_PUBLICATION_FAILED, true)

    return response.data.html_url!
}

/**
 * Generate a custom url that when clicked allows you to compose a tweet ready to be shared.
 * @param ceremonyName <string> - the name of the ceremony.
 * @param gistUrl <string> - the url of the gist where the public attestation has been shared.
 * @param isFinalizing <boolean> - flag to discriminate between ceremony finalization (true) and contribution (false).
 * @returns <string> - the ready to share tweet url.
 */
export const generateCustomUrlToTweetAboutParticipation = (
    ceremonyName: string,
    gistUrl: string,
    isFinalizing: boolean
) =>
    isFinalizing
        ? `https://twitter.com/intent/tweet?text=I%20have%20finalized%20the%20${ceremonyName}%20Phase%202%20Trusted%20Setup%20ceremony!%20You%20can%20view%20my%20final%20attestation%20here:%20${gistUrl}%20#Ethereum%20#ZKP%20#PSE`
        : `https://twitter.com/intent/tweet?text=I%20contributed%20to%20the%20${ceremonyName}%20Phase%202%20Trusted%20Setup%20ceremony!%20You%20can%20contribute%20here:%20https://github.com/quadratic-funding/mpc-phase2-suite%20You%20can%20view%20my%20attestation%20here:%20${gistUrl}%20#Ethereum%20#ZKP`

/**
 * Return a custom progress bar.
 * @param type <ProgressBarType> - the type of the progress bar.
 * @param [message] <string> - additional information to be displayed when downloading/uploading.
 * @returns <SingleBar> - a new custom (single) progress bar.
 */
const customProgressBar = (type: ProgressBarType, message?: string): SingleBar => {
    // Formats.
    const uploadFormat = `${theme.emojis.arrowUp}  Uploading ${message} [${theme.colors.magenta(
        "{bar}"
    )}] {percentage}% | {value}/{total} Chunks`

    const downloadFormat = `${theme.emojis.arrowDown}  Downloading ${message} [${theme.colors.magenta(
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
 * Download an artifact from the ceremony bucket.
 * @dev this method request a pre-signed url to make a GET request to download the artifact.
 * @param cloudFunctions <Functions> - the instance of the Firebase cloud functions for the application.
 * @param bucketName <string> - the name of the ceremony artifacts bucket (AWS S3).
 * @param storagePath <string> - the storage path that locates the artifact to be downloaded in the bucket.
 * @param localPath <string> - the local path where the artifact will be downloaded.
 */
export const downloadCeremonyArtifact = async (
    cloudFunctions: Functions,
    bucketName: string,
    storagePath: string,
    localPath: string
): Promise<void> => {
    // Request pre-signed url to make GET download request.
    const getPreSignedUrl = await generateGetObjectPreSignedUrl(cloudFunctions, bucketName, storagePath)

    // Make fetch to get info about the artifact.
    const response = await fetch(getPreSignedUrl)

    if (response.status !== 200 && !response.ok)
        showError(CORE_SERVICES_ERRORS.AWS_CEREMONY_BUCKET_CANNOT_DOWNLOAD_GET_PRESIGNED_URL, true)

    // Extract and prepare data.
    const content: any = response.body
    const contentLength = Number(response.headers.get("content-length"))
    const contentLengthInGB = convertBytesOrKbToGb(contentLength, true)

    // Prepare stream.
    const writeStream = createWriteStream(localPath)

    // Prepare custom progress bar.
    const progressBar = customProgressBar(ProgressBarType.DOWNLOAD, `last contribution`)
    const progressBarStep = contentLengthInGB / 100
    let chunkLengthWritingProgress = 0
    let completedProgress = progressBarStep

    // Bootstrap the progress bar.
    progressBar.start(contentLengthInGB < 0.01 ? 0.01 : parseFloat(contentLengthInGB.toFixed(2)).valueOf(), 0)

    // Write chunk by chunk.
    for await (const chunk of content) {
        // Write chunk.
        writeStream.write(chunk)
        // Update current progress.
        chunkLengthWritingProgress += convertBytesOrKbToGb(chunk.length, true)

        // Display the current progress.
        while (chunkLengthWritingProgress >= completedProgress) {
            // Store new completed progress step by step.
            completedProgress += progressBarStep

            // Display accordingly in the progress bar.
            progressBar.update(contentLengthInGB < 0.01 ? 0.01 : parseFloat(completedProgress.toFixed(2)).valueOf())
        }
    }

    await sleep(2000) // workaround to show bar for small artifacts.

    progressBar.stop()
}

/**
 *
 * @param lastZkeyLocalFilePath <string> - the local path of the last contribution.
 * @param nextZkeyLocalFilePath <string> - the local path where the next contribution is going to be stored.
 * @param entropyOrBeacon <string> - the entropy or beacon (only when finalizing) for the contribution.
 * @param contributorOrCoordinatorIdentifier <string> - the identifier of the contributor or coordinator (only when finalizing).
 * @param averageComputingTime <number> - the current average contribution computation time.
 * @param transcriptLogger <Logger> - the custom file logger to generate the contribution transcript.
 * @param isFinalizing <boolean> - flag to discriminate between ceremony finalization (true) and contribution (false).
 * @returns <Promise<number>> - the amount of time spent contributing.
 */
export const handleContributionComputation = async (
    lastZkeyLocalFilePath: string,
    nextZkeyLocalFilePath: string,
    entropyOrBeacon: string,
    contributorOrCoordinatorIdentifier: string,
    averageComputingTime: number,
    transcriptLogger: Logger,
    isFinalizing: boolean
): Promise<number> => {
    // Prepare timer (statistics only).
    const computingTimer = new Timer({ label: ParticipantContributionStep.COMPUTING })
    computingTimer.start()

    // Time format.
    const { seconds, minutes, hours, days } = getSecondsMinutesHoursFromMillis(averageComputingTime)

    const spinner = customSpinner(
        `${isFinalizing ? `Applying beacon...` : `Computing contribution...`} ${
            averageComputingTime > 0
                ? `(ETA ${theme.text.bold(
                      `${convertToDoubleDigits(days)}:${convertToDoubleDigits(hours)}:${convertToDoubleDigits(
                          minutes
                      )}:${convertToDoubleDigits(seconds)}`
                  )})`
                : ``
        }`,
        `clock`
    )
    spinner.start()

    // Discriminate between contribution finalization or computation.
    if (isFinalizing)
        await zKey.beacon(
            lastZkeyLocalFilePath,
            nextZkeyLocalFilePath,
            contributorOrCoordinatorIdentifier,
            entropyOrBeacon,
            numExpIterations,
            transcriptLogger
        )
    else
        await zKey.contribute(
            lastZkeyLocalFilePath,
            nextZkeyLocalFilePath,
            contributorOrCoordinatorIdentifier,
            entropyOrBeacon,
            transcriptLogger
        )

    computingTimer.stop()

    await sleep(3000) // workaround for file descriptor.

    spinner.stop()

    return computingTimer.ms()
}

/**
 * Return the most up-to-date data about the participant document for the given ceremony.
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param participantId <string> - the unique identifier of the participant.
 * @returns <Promise<DocumentData>> - the most up-to-date participant data.
 */
export const getLatestUpdatesFromParticipant = async (
    firestoreDatabase: Firestore,
    ceremonyId: string,
    participantId: string
): Promise<DocumentData> => {
    // Fetch participant data.
    const participant = await getDocumentById(
        firestoreDatabase,
        getParticipantsCollectionPath(ceremonyId),
        participantId
    )

    if (!participant.data()) showError(COMMAND_ERRORS.COMMAND_CONTRIBUTE_NO_PARTICIPANT_DATA, true)

    return participant.data()!
}

/**
 * Start or resume a contribution from the last participant contribution step.
 * @notice this method goes through each contribution stage following this order:
 * 1) Downloads the last contribution from previous contributor.
 * 2) Computes the new contribution.
 * 3) Uploads the new contribution.
 * 4) Requests the verification of the new contribution to the coordinator's backend and waits for the result.
 * @param cloudFunctions <Functions> - the instance of the Firebase cloud functions for the application.
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @param ceremony <FirebaseDocumentInfo> - the Firestore document of the ceremony.
 * @param circuit <FirebaseDocumentInfo> - the Firestore document of the ceremony circuit.
 * @param participant <FirebaseDocumentInfo> - the Firestore document of the participant (contributor or coordinator).
 * @param participantContributionStep <ParticipantContributionStep> - the contribution step of the participant (from where to start/resume contribution).
 * @param entropyOrBeaconHash <string> - the entropy or beacon hash (only when finalizing) for the contribution.
 * @param contributorOrCoordinatorIdentifier <string> - the identifier of the contributor or coordinator (only when finalizing).
 * @param isFinalizing <boolean> - flag to discriminate between ceremony finalization (true) and contribution (false).
 */
export const handleStartOrResumeContribution = async (
    cloudFunctions: Functions,
    firestoreDatabase: Firestore,
    ceremony: FirebaseDocumentInfo,
    circuit: FirebaseDocumentInfo,
    participant: FirebaseDocumentInfo,
    entropyOrBeaconHash: any,
    contributorOrCoordinatorIdentifier: string,
    isFinalizing: boolean
): Promise<void> => {
    // Extract data.
    const { prefix: ceremonyPrefix } = ceremony.data
    const { waitingQueue, avgTimings, prefix: circuitPrefix, sequencePosition } = circuit.data
    const { completedContributions } = waitingQueue // = current progress.

    console.log(
        `${theme.text.bold(`\n- Circuit # ${theme.colors.magenta(`${sequencePosition}`)}`)} (Contribution Steps)`
    )

    // Get most up-to-date data from the participant document.
    let participantData = await getLatestUpdatesFromParticipant(firestoreDatabase, ceremony.id, participant.id)

    const spinner = customSpinner(
        `${
            participantData.contributionStep === ParticipantContributionStep.DOWNLOADING
                ? `Preparing to begin the contribution...`
                : `Preparing to resume contribution`
        }`,
        `clock`
    )
    spinner.start()

    // Compute zkey indexes.
    const lastZkeyIndex = formatZkeyIndex(completedContributions)
    const nextZkeyIndex = formatZkeyIndex(completedContributions + 1)

    // Prepare zKey filenames.
    const lastZkeyCompleteFilename = `${circuitPrefix}_${lastZkeyIndex}.zkey`
    const nextZkeyCompleteFilename = isFinalizing
        ? `${circuitPrefix}_${finalContributionIndex}.zkey`
        : `${circuitPrefix}_${nextZkeyIndex}.zkey`
    // Prepare zKey storage paths.
    const lastZkeyStorageFilePath = getZkeyStorageFilePath(circuitPrefix, lastZkeyCompleteFilename)
    const nextZkeyStorageFilePath = getZkeyStorageFilePath(circuitPrefix, nextZkeyCompleteFilename)
    // Prepare zKey local paths.
    const lastZkeyLocalFilePath = isFinalizing
        ? getFinalZkeyLocalFilePath(lastZkeyCompleteFilename)
        : getContributionLocalFilePath(lastZkeyCompleteFilename)
    const nextZkeyLocalFilePath = isFinalizing
        ? getFinalZkeyLocalFilePath(nextZkeyCompleteFilename)
        : getContributionLocalFilePath(nextZkeyCompleteFilename)

    // Generate a custom file logger for contribution transcript.
    const transcriptCompleteFilename = isFinalizing
        ? `${circuit.data.prefix}_${contributorOrCoordinatorIdentifier}_${finalContributionIndex}.log`
        : `${circuit.data.prefix}_${nextZkeyIndex}.log`
    const transcriptLocalFilePath = isFinalizing
        ? getFinalTranscriptLocalFilePath(transcriptCompleteFilename)
        : getTranscriptLocalFilePath(transcriptCompleteFilename)
    const transcriptLogger = createCustomLoggerForFile(transcriptLocalFilePath)

    // Populate transcript file w/ header.
    transcriptLogger.info(
        `${isFinalizing ? `Final` : `Contribution`} transcript for ${circuitPrefix} phase 2 contribution.\n${
            isFinalizing
                ? `Coordinator: ${contributorOrCoordinatorIdentifier}`
                : `Contributor # ${Number(nextZkeyIndex)}`
        } (${contributorOrCoordinatorIdentifier})\n`
    )

    // Get ceremony bucket name.
    const bucketName = getBucketName(ceremonyPrefix, String(process.env.CONFIG_CEREMONY_BUCKET_POSTFIX))

    spinner.stop()

    // Contribution step = DOWNLOADING.
    if (isFinalizing || participantData.contributionStep === ParticipantContributionStep.DOWNLOADING) {
        // Download the latest contribution from bucket.
        await downloadCeremonyArtifact(cloudFunctions, bucketName, lastZkeyStorageFilePath, lastZkeyLocalFilePath)

        console.log(
            `${theme.symbols.success} Contribution ${theme.text.bold(`#${lastZkeyIndex}`)} correctly downloaded`
        )

        // Advance to next contribution step (COMPUTING) if not finalizing.
        if (!isFinalizing) {
            spinner.text = `Preparing for contribution computation...`
            spinner.start()

            await progressToNextContributionStep(cloudFunctions, ceremony.id)

            // Refresh most up-to-date data from the participant document.
            participantData = await getLatestUpdatesFromParticipant(firestoreDatabase, ceremony.id, participant.id)

            spinner.stop()
        }
    } else
        console.log(`${theme.symbols.success} Contribution ${theme.text.bold(`#${lastZkeyIndex}`)} already downloaded`)

    // Contribution step = COMPUTING.
    if (isFinalizing || participantData.contributionStep === ParticipantContributionStep.COMPUTING) {
        // Handle the next contribution computation.
        const computingTime = await handleContributionComputation(
            lastZkeyLocalFilePath,
            nextZkeyLocalFilePath,
            entropyOrBeaconHash,
            contributorOrCoordinatorIdentifier,
            avgTimings.contributionComputation,
            transcriptLogger,
            isFinalizing
        )

        // Permanently store on db the contribution hash and computing time.
        spinner.text = `Writing contribution metadata...`
        spinner.start()

        // Read local transcript file info to get the contribution hash.
        const transcriptContents = readFile(transcriptLocalFilePath)
        const matchContributionHash = transcriptContents.match(/Contribution.+Hash.+\n\t\t.+\n\t\t.+\n.+\n\t\t.+\n/)

        if (!matchContributionHash)
            showError(COMMAND_ERRORS.COMMAND_CONTRIBUTE_FINALIZE_NO_TRANSCRIPT_CONTRIBUTION_HASH_MATCH, true)

        // Format contribution hash.
        const contributionHash = matchContributionHash?.at(0)?.replace("\n\t\t", "")!

        // Make request to cloud functions to permanently store the information.
        await permanentlyStoreCurrentContributionTimeAndHash(
            cloudFunctions,
            ceremony.id,
            computingTime,
            contributionHash
        )

        // Format computing time.
        const {
            seconds: computationSeconds,
            minutes: computationMinutes,
            hours: computationHours
        } = getSecondsMinutesHoursFromMillis(computingTime)

        spinner.succeed(
            `${
                isFinalizing ? "Contribution" : `Contribution ${theme.text.bold(`#${nextZkeyIndex}`)}`
            } computation took ${theme.text.bold(
                `${convertToDoubleDigits(computationHours)}:${convertToDoubleDigits(
                    computationMinutes
                )}:${convertToDoubleDigits(computationSeconds)}`
            )}`
        )

        // Advance to next contribution step (UPLOADING) if not finalizing.
        if (!isFinalizing) {
            spinner.text = `Preparing for uploading the contribution...`
            spinner.start()

            await progressToNextContributionStep(cloudFunctions, ceremony.id)

            // Refresh most up-to-date data from the participant document.
            participantData = await getLatestUpdatesFromParticipant(firestoreDatabase, ceremony.id, participant.id)

            spinner.stop()
        }
    } else console.log(`${theme.symbols.success} Contribution ${theme.text.bold(`#${nextZkeyIndex}`)} already computed`)

    // Contribution step = UPLOADING.
    if (isFinalizing || participantData.contributionStep === ParticipantContributionStep.UPLOADING) {
        spinner.text = `Uploading ${isFinalizing ? "final" : ""} contribution ${
            !isFinalizing ? theme.text.bold(`#${nextZkeyIndex}`) : ""
        } to storage...`
        spinner.start()

        if (!isFinalizing)
            await multiPartUpload(
                cloudFunctions,
                bucketName,
                nextZkeyStorageFilePath,
                nextZkeyLocalFilePath,
                Number(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB),
                ceremony.id,
                participantData.tempContributionData
            )
        else
            await multiPartUpload(
                cloudFunctions,
                bucketName,
                nextZkeyStorageFilePath,
                nextZkeyLocalFilePath,
                Number(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB)
            )

        spinner.succeed(
            `${
                isFinalizing ? `Contribution` : `Contribution ${theme.text.bold(`#${nextZkeyIndex}`)}`
            } correctly saved on storage`
        )

        // Advance to next contribution step (VERIFYING) if not finalizing.
        if (!isFinalizing) {
            spinner.text = `Preparing for requesting contribution verification...`
            spinner.start()

            await progressToNextContributionStep(cloudFunctions, ceremony.id)

            // Refresh most up-to-date data from the participant document.
            participantData = await getLatestUpdatesFromParticipant(firestoreDatabase, ceremony.id, participant.id)

            spinner.stop()
        }
    }

    // Contribution step = VERIFYING.
    if (isFinalizing || participantData.contributionStep === ParticipantContributionStep.VERIFYING) {
        // Format verification time.
        const { seconds, minutes, hours } = getSecondsMinutesHoursFromMillis(avgTimings.verifyCloudFunction)

        // Custom spinner for visual feedback.
        spinner.text = `Verifying your contribution... ${
            avgTimings.verifyCloudFunction > 0
                ? `(~ ${theme.text.bold(
                      `${convertToDoubleDigits(hours)}:${convertToDoubleDigits(minutes)}:${convertToDoubleDigits(
                          seconds
                      )}`
                  )})`
                : ``
        }\n`
        spinner.start()

        // Execute contribution verification.
        const { valid } = await verifyContribution(
            cloudFunctions,
            ceremony.id,
            circuit,
            bucketName,
            contributorOrCoordinatorIdentifier,
            String(process.env.FIREBASE_CF_URL_VERIFY_CONTRIBUTION)
        )

        await sleep(3000) // workaround cf termination.

        // Display verification output.
        if (valid)
            spinner.succeed(
                `${
                    isFinalizing
                        ? `Contribution`
                        : `Contribution ${theme.text.bold(`#${nextZkeyIndex}`)} has been evaluated as`
                } ${theme.text.bold("valid")}`
            )
        else
            spinner.fail(
                `${
                    isFinalizing
                        ? `Contribution`
                        : `Contribution ${theme.text.bold(`#${nextZkeyIndex}`)} has been evaluated as`
                } ${theme.text.bold("invalid")}`
            )
    }
}
