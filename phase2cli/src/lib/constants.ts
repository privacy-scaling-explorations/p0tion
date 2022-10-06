import chalk from "chalk"
import logSymbols from "log-symbols"
import emoji from "node-emoji"

/** Theme */
export const theme = {
  yellow: chalk.yellow,
  magenta: chalk.magenta,
  red: chalk.red,
  green: chalk.green,
  underlined: chalk.underline,
  bold: chalk.bold,
  italic: chalk.italic
}

export const symbols = {
  success: logSymbols.success,
  warning: logSymbols.warning,
  error: logSymbols.error,
  info: logSymbols.info
}

export const emojis = {
  tada: emoji.get("tada"),
  key: emoji.get("key"),
  broom: emoji.get("broom"),
  pointDown: emoji.get("point_down"),
  eyes: emoji.get("eyes"),
  wave: emoji.get("wave"),
  clipboard: emoji.get("clipboard"),
  fire: emoji.get("fire"),
  clock: emoji.get("hourglass"),
  dizzy: emoji.get("dizzy_face"),
  rocket: emoji.get("rocket"),
  oldKey: emoji.get("old_key"),
  pray: emoji.get("pray"),
  moon: emoji.get("moon"),
  upsideDown: emoji.get("upside_down_face"),
  arrowUp: emoji.get("arrow_up"),
  arrowDown: emoji.get("arrow_down")
}

/** ZK related */
export const potDownloadUrlTemplate = `https://hermez.s3-eu-west-1.amazonaws.com/`
export const potFilenameTemplate = `powersOfTau28_hez_final_`
export const firstZkeyIndex = `00000`
export const numIterationsExp = 10
export const solidityVersion = "0.8.0"

/** Commands related */
export const observationWaitingTimeInMillis = 3000 // 3 seconds.

/** Shared */
export const names = {
  output: `output`,
  setup: `setup`,
  contribute: `contribute`,
  finalize: `finalize`,
  pot: `pot`,
  zkeys: `zkeys`,
  vkeys: `vkeys`,
  metadata: `metadata`,
  transcripts: `transcripts`,
  attestation: `attestation`,
  verifiers: `verifiers`
}

const outputPath = `./${names.output}`
const setupPath = `${outputPath}/${names.setup}`
const contributePath = `${outputPath}/${names.contribute}`
const finalizePath = `${outputPath}/${names.finalize}`
const potPath = `${setupPath}/${names.pot}`
const zkeysPath = `${setupPath}/${names.zkeys}`
const metadataPath = `${setupPath}/${names.metadata}`
const contributionsPath = `${contributePath}/${names.zkeys}`
const contributionTranscriptsPath = `${contributePath}/${names.transcripts}`
const attestationPath = `${contributePath}/${names.attestation}`
const finalZkeysPath = `${finalizePath}/${names.zkeys}`
const finalPotPath = `${finalizePath}/${names.pot}`
const finalTranscriptsPath = `${finalizePath}/${names.transcripts}`
const finalAttestationsPath = `${finalizePath}/${names.attestation}`
const verificationKeysPath = `${finalizePath}/${names.vkeys}`
const verifierContractsPath = `${finalizePath}/${names.verifiers}`

export const paths = {
  outputPath,
  setupPath,
  contributePath,
  finalizePath,
  potPath,
  zkeysPath,
  metadataPath,
  contributionsPath,
  contributionTranscriptsPath,
  attestationPath,
  finalZkeysPath,
  finalPotPath,
  finalTranscriptsPath,
  finalAttestationsPath,
  verificationKeysPath,
  verifierContractsPath
}

/** Firebase */
export const collections = {
  users: "users",
  participants: "participants",
  ceremonies: "ceremonies",
  circuits: "circuits",
  contributions: "contributions",
  timeouts: "timeouts"
}

export const ceremoniesCollectionFields = {
  coordinatorId: "coordinatorId",
  description: "description",
  endDate: "endDate",
  lastUpdated: "lastUpdated",
  prefix: "prefix",
  startDate: "startDate",
  state: "state",
  title: "title",
  type: "type"
}

export const contributionsCollectionFields = {
  contributionTime: "contributionTime",
  files: "files",
  lastUpdated: "lastUpdated",
  participantId: "participantId",
  valid: "valid",
  verificationTime: "verificationTime",
  zkeyIndex: "zKeyIndex"
}

export const timeoutsCollectionFields = {
  startDate: "startDate",
  endDate: "endDate"
}
