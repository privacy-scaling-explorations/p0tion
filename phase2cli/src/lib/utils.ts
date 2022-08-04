import { request } from "@octokit/request"
import { DocumentData, QueryDocumentSnapshot, Timestamp } from "firebase/firestore"
import ora, { Ora } from "ora"
import figlet from "figlet"
import clear from "clear"
import { zKey } from "snarkjs"
import winston, { Logger } from "winston"
import { Functions, httpsCallableFromURL } from "firebase/functions"
import { Timer } from "timer-node"
import { FirebaseDocumentInfo, FirebaseServices, Timing, VerifyContributionComputation } from "../../types/index.js"
import { collections, emojis, firstZkeyIndex, numIterationsExp, paths, symbols, theme } from "./constants.js"
import { downloadFileFromStorage, initServices, uploadFileToStorage } from "./firebase.js"
import { GENERIC_ERRORS, GITHUB_ERRORS, showError } from "./errors.js"
import { askForConfirmation, askForEntropyOrBeacon } from "./prompts.js"
import { writeFile, readFile, readLocalJsonFile } from "./files.js"
// Get local configs.
const { firebase } = readLocalJsonFile("../../env.json")

/**
 * Get the Github username for the logged in user.
 * @param token <string> - the Github OAuth 2.0 token.
 * @returns <Promise<string>> - the user Github username.
 */
export const getGithubUsername = async (token: string): Promise<string> => {
  // Get user info from Github APIs.
  const response = await request("GET https://api.github.com/user", {
    headers: {
      authorization: `token ${token}`
    }
  })

  if (response) return response.data.login
  showError(GITHUB_ERRORS.GITHUB_GET_USERNAME_FAILED, true)

  return process.exit(0) // nb. workaround to avoid type issues.
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
 * Helper for obtaining uid and data for query document snapshots.
 * @param queryDocSnap <Array<QueryDocumentSnapshot>> - the array of query document snapshot to be converted.
 * @returns Array<FirebaseDocumentInfo>
 */
export const fromQueryToFirebaseDocumentInfo = (
  queryDocSnap: Array<QueryDocumentSnapshot>
): Array<FirebaseDocumentInfo> =>
  queryDocSnap.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
    id: doc.id,
    ref: doc.ref,
    data: doc.data()
  }))

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
 * Get a value from a key information about a circuit.
 * @param circuitInfo <string> - the stringified content of the .r1cs file.
 * @param rgx <RegExp> - regular expression to match the key.
 * @returns <string>
 */
export const getCircuitMetadataFromR1csFile = (circuitInfo: string, rgx: RegExp): string => {
  // Match.
  const matchInfo = circuitInfo.match(rgx)

  if (!matchInfo) showError(GENERIC_ERRORS.GENERIC_R1CS_MISSING_INFO, true)

  // Split and return the value.
  return matchInfo?.at(0)?.split(":")[1].replace(" ", "").split("#")[0].replace("\n", "")!
}

/**
 * Return the necessary Power of Tau "powers" given the number of circuits constraints.
 * @param constraints <number> - the number of circuit contraints
 * @returns <number>
 */
export const estimatePoT = (constraints: number): number => {
  let power = 2
  let pot = 2 ** power

  while (constraints * 2 > pot) {
    power += 1
    pot = 2 ** power
  }

  return power
}

/**
 * Get the powers from pot file name
 * @dev the pot files must follow these convention (i_am_a_pot_file_09.ptau) where the numbers before '.ptau' are the powers.
 * @param potFileName <string>
 * @returns <number>
 */
export const extractPoTFromFilename = (potFileName: string): number =>
  Number(potFileName.split("_").pop()?.split(".").at(0))

/**
 * Extract a prefix (like_this) from a provided string with special characters and spaces.
 * @dev replaces all symbols and whitespaces with underscore.
 * @param str <string>
 * @returns <string>
 */
export const extractPrefix = (str: string): string =>
  // eslint-disable-next-line no-useless-escape
  str.replace(/[`\s~!@#$%^&*()|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, "_").toLowerCase()

/**
 * Format the next zkey index.
 * @param progress <number> - the progression in zkey index (= contributions).
 * @returns <string>
 */
export const formatZkeyIndex = (progress: number): string => {
  let index = progress.toString()

  while (index.length < firstZkeyIndex.length) {
    index = `0${index}`
  }

  return index
}

/**
 * Convert milliseconds to seconds.
 * @param millis <number>
 * @returns <number>
 */
export const convertMillisToSeconds = (millis: number): number => Number((millis / 1000).toFixed(2))

/**
 * Return the current server timestamp in milliseconds.
 * @returns <number>
 */
export const getServerTimestampInMillis = (): number => Timestamp.now().toMillis()

/**
 * Bootstrap whatever is needed for a new command execution (clean terminal, print header, init Firebase services).
 * @returns <Promise<FirebaseServices>>
 */
export const bootstrapCommandExec = async (): Promise<FirebaseServices> => {
  // Clean terminal window.
  clear()

  // Print header.
  console.log(theme.magenta(figlet.textSync("Phase 2 cli", { font: "Ogre" })))

  // Initialize Firebase services
  return initServices()
}

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
 * @returns <Promise<unknown>>
 */
export const sleep = (ms: number): Promise<unknown> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Handle the request/generation for a random entropy or beacon value.
 * @param askEntropy <boolean> - true when requesting entropy; otherwise false.
 * @return <Promise<string>>
 */
export const getEntropyOrBeacon = async (askEntropy: boolean): Promise<string> => {
  // Prompt for entropy.
  const { confirmation } = await askForConfirmation(
    `Do you prefer to enter ${askEntropy ? `entropy` : `beacon`} manually?`
  )

  if (confirmation === undefined) showError(GENERIC_ERRORS.GENERIC_DATA_INPUT, true)

  let value: any

  if (!confirmation) {
    const spinner = customSpinner(`Generating ${askEntropy ? `random entropy` : `beacon`}...`, "clock")
    spinner.start()

    // Took inspiration from here https://github.com/glamperd/setup-mpc-ui/blob/master/client/src/state/Compute.tsx#L112.
    value = new Uint8Array(64).map(() => Math.random() * 256).toString()

    spinner.stop()
    console.log(`${symbols.success} ${askEntropy ? `Random entropy` : `Beacon`} successfully generated`)
  } else value = await askForEntropyOrBeacon(askEntropy)

  return value
}

/**
 * Compute a new Groth 16 Phase 2 contribution.
 * @param lastZkey <string> - the local path to last zkey.
 * @param newZkey <string> - the local path to new zkey.
 * @param name <string> - the name of the contributor.
 * @param entropyOrBeacon <string> - the value representing the entropy or beacon.
 * @param logger <Logger | Console> - custom winston or console logger.
 * @param finalize <boolean> - true when finalizing the ceremony with the last contribution; otherwise false.
 * @param avgContributionTimeInMillis <number> - the average contribution time in milliseconds for the circuit.
 */
export const computeContribution = async (
  lastZkey: string,
  newZkey: string,
  name: string,
  entropyOrBeacon: string,
  logger: Logger | Console,
  finalize: boolean,
  avgContributionTimeInMillis: number
) => {
  // Format average contribution time.
  const { seconds, minutes, hours } = getSecondsMinutesHoursFromMillis(avgContributionTimeInMillis)

  // Custom spinner for visual feedback.
  const spinner = customSpinner(
    `${finalize ? `Applying beacon...` : `Computing contribution...`} ${
      avgContributionTimeInMillis > 0
        ? `(est. time ${theme.bold(
            `${convertToDoubleDigits(hours)}:${convertToDoubleDigits(minutes)}:${convertToDoubleDigits(seconds)}`
          )})`
        : ``
    }`,
    "clock"
  )

  spinner.start()

  if (finalize)
    // Finalize applying a random beacon.
    await zKey.beacon(lastZkey, newZkey, name, entropyOrBeacon, numIterationsExp, logger)
  // Compute the next contribution.
  else await zKey.contribute(lastZkey, newZkey, name, entropyOrBeacon, logger)

  spinner.stop()
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
 * Download a local copy of the zkey.
 * @param storagePath <string> - the Storage path where the zkey is stored.
 * @param localPath <string> - the local path where to store the downloaded zkey.
 * @param showSpinner <boolean> - true to show a custom spinner on the terminal; otherwise false.
 */
export const downloadContribution = async (storagePath: string, localPath: string, showSpinner: boolean) => {
  // Custom spinner for visual feedback.
  const spinner: Ora = customSpinner(`Downloading contribution...`, "clock")

  if (showSpinner) spinner.start()

  // Download from storage.
  const content = await downloadFileFromStorage(storagePath)

  // Store locally.
  writeFile(localPath, content)

  if (showSpinner) spinner.stop()
}

/**
 * Upload the new zkey to the storage.
 * @param storagePath <string> - the Storage path where the zkey will be stored.
 * @param localPath <string> - the local path where the zkey is stored.
 * @param showSpinner <boolean> - true to show a custom spinner on the terminal; otherwise false.
 */
export const uploadContribution = async (storagePath: string, localPath: string, showSpinner: boolean) => {
  // Custom spinner for visual feedback.
  const spinner = customSpinner("Storing your contribution...", "clock")
  if (showSpinner) spinner.start()

  // Upload to storage.
  await uploadFileToStorage(localPath, storagePath)

  if (showSpinner) spinner.stop()
}

/**
 * Compute a new Groth16 contribution verification.
 * @param ceremony <FirebaseDocumentInfo> - the ceremony document.
 * @param circuit <FirebaseDocumentInfo> - the circuit document.
 * @param ghUsername <string> - the Github username of the user.
 * @param contributionTimeInMillis <number> - the contribution time in milliseconds.
 * @param avgVerificationTimeInMillis <number> - the average verification time in milliseconds.
 * @param firebaseFunctions <Functions> - the object containing the firebase functions.
 * @returns <Promise<VerifyContributionComputation>>
 */
export const computeVerification = async (
  ceremony: FirebaseDocumentInfo,
  circuit: FirebaseDocumentInfo,
  ghUsername: string,
  contributionTimeInMillis: number,
  avgVerificationTimeInMillis: number,
  firebaseFunctions: Functions
): Promise<VerifyContributionComputation> => {
  // Format average verification time.
  const { seconds, minutes, hours } = getSecondsMinutesHoursFromMillis(avgVerificationTimeInMillis)

  // Custom spinner for visual feedback.
  const spinner = customSpinner(
    `Verifying your contribution... ${
      avgVerificationTimeInMillis > 0
        ? `(est. time ${theme.bold(
            `${convertToDoubleDigits(hours)}:${convertToDoubleDigits(minutes)}:${convertToDoubleDigits(seconds)}`
          )})`
        : ``
    }\n`,
    "clock"
  )
  spinner.start()

  // Verify contribution callable Cloud Function.
  const verifyContribution = httpsCallableFromURL(firebaseFunctions!, firebase.FIREBASE_CF_URL_VERIFY_CONTRIBUTION!)

  // The verification must be done remotely (Cloud Functions).
  const { data }: any = await verifyContribution({
    ceremonyId: ceremony.id,
    circuitId: circuit.id,
    contributionTimeInMillis,
    ghUsername
  })

  if (!data) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

  spinner.stop()

  return { valid: data.valid, verificationTimeInMillis: data.verificationTimeInMillis }
}

/**
 * Compute a new contribution for the participant.
 * @param ceremony <FirebaseDocumentInfo> - the ceremony document.
 * @param circuit <FirebaseDocumentInfo> - the circuit document.
 * @param entropyOrBeacon <any> - the entropy/beacon for the contribution.
 * @param ghUsername <string> - the Github username of the user.
 * @param finalize <boolean> - true if the contribution finalize the ceremony; otherwise false.
 * @param attestation <string> - the attestation for the participant contribution.
 * @param firebaseFunctions <Functions> - the object containing the firebase functions.
 * @returns <Promise<string>> - new updated attestation file.
 */
export const makeContribution = async (
  ceremony: FirebaseDocumentInfo,
  circuit: FirebaseDocumentInfo,
  entropyOrBeacon: any,
  ghUsername: string,
  finalize: boolean,
  attestation: string,
  firebaseFunctions: Functions
): Promise<string> => {
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

  // Write first message.
  transcriptLogger.info(
    `${finalize ? `Final` : `Contribution`} transcript for ${circuit.data.prefix} phase 2 contribution.\n${
      finalize ? `Coordinator: ${ghUsername}` : `Contributor # ${Number(nextZkeyIndex)}`
    } (${ghUsername})\n`
  )

  console.log(theme.bold(`\n- Circuit # ${theme.magenta(`${circuit.data.sequencePosition}`)}`))

  // Keep track of contribution computation time.
  const timer = new Timer({ label: "contributionTime" })
  timer.start()

  // 1. Download last contribution.
  let storagePath = `${ceremony.data.prefix}/${collections.circuits}/${circuit.data.prefix}/${collections.contributions}/${circuit.data.prefix}_${currentZkeyIndex}.zkey`
  let localPath = `${contributionsPath}/${circuit.data.prefix}_${currentZkeyIndex}.zkey`

  await downloadContribution(storagePath, localPath, true)

  console.log(`${symbols.success} Contribution ${theme.bold(`#${currentZkeyIndex}`)} correctly downloaded`)

  // 2. Compute the new contribution.
  await computeContribution(
    `${contributionsPath}/${circuit.data.prefix}_${currentZkeyIndex}.zkey`,
    `${contributionsPath}/${circuit.data.prefix}_${finalize ? `final` : nextZkeyIndex}.zkey`,
    ghUsername,
    entropyOrBeacon,
    transcriptLogger,
    finalize,
    avgTimings.avgContributionTime
  )

  // Estimate contribution time.
  timer.stop()

  const contributionTimeInMillis = timer.ms()

  const {
    seconds: contributionSeconds,
    minutes: contributionMinutes,
    hours: contributionHours
  } = getSecondsMinutesHoursFromMillis(contributionTimeInMillis)
  console.log(
    `${symbols.success} ${
      finalize ? "Contribution" : `Contribution ${theme.bold(`#${nextZkeyIndex}`)}`
    } computation took ${theme.bold(
      `${convertToDoubleDigits(contributionHours)}:${convertToDoubleDigits(
        contributionMinutes
      )}:${convertToDoubleDigits(contributionSeconds)}`
    )}`
  )

  // 3. Store files.
  // Upload .zkey file.
  storagePath = `${ceremony.data.prefix}/${collections.circuits}/${circuit.data.prefix}/${collections.contributions}/${
    circuit.data.prefix
  }_${finalize ? `final` : nextZkeyIndex}.zkey`
  localPath = `${contributionsPath}/${circuit.data.prefix}_${finalize ? `final` : nextZkeyIndex}.zkey`

  await uploadContribution(storagePath, localPath, true)

  console.log(
    `${symbols.success} ${
      finalize ? `Contribution` : `Contribution ${theme.bold(`#${nextZkeyIndex}`)}`
    } correctly saved on storage`
  )

  // 4. Verify contribution.
  const { valid, verificationTimeInMillis } = await computeVerification(
    ceremony,
    circuit,
    ghUsername,
    contributionTimeInMillis,
    avgTimings.avgVerificationTime,
    firebaseFunctions
  )

  const {
    seconds: verificationSeconds,
    minutes: verificationMinutes,
    hours: verificationHours
  } = getSecondsMinutesHoursFromMillis(verificationTimeInMillis)

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

  // 5. Generate attestation from single contribution transcripts from each circuit.
  const transcript = readFile(contributionTranscriptLocalPath)

  const matchContributionHash = transcript.match(/Contribution.+Hash.+\n\t\t.+\n\t\t.+\n.+\n\t\t.+\n/)

  if (!matchContributionHash) showError(GENERIC_ERRORS.GENERIC_CONTRIBUTION_HASH_INVALID, true)

  const contributionAttestation = matchContributionHash?.at(0)?.replace("\n\t\t", "")

  return `${attestation}\n\nCircuit # ${circuit.data.sequencePosition} (${circuit.data.prefix})\nContributor # ${Number(
    nextZkeyIndex
  )}\n${contributionAttestation}`
}
