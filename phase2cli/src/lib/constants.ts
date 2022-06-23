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
  oldKey: emoji.get("old_key")
}

/** ZK related */
export const potDownloadUrlTemplate = `https://hermez.s3-eu-west-1.amazonaws.com/`
export const potFilenameTemplate = `powersOfTau28_hez_final_`

export const firstZkeyIndex = `00000`

/** Shared */
export const names = {
  output: `output`,
  setup: `setup`,
  contribute: `contribute`,
  pot: `pot`,
  zkeys: `zkeys`,
  metadata: `metadata`,
  transcripts: `transcripts`,
  attestation: `attestation`
}

const outputPath = `./${names.output}`
const setupPath = `${outputPath}/${names.setup}`
const contributePath = `${outputPath}/${names.contribute}`
const potPath = `${setupPath}/${names.pot}`
const zkeysPath = `${setupPath}/${names.zkeys}`
const metadataPath = `${setupPath}/${names.metadata}`
const contributionsPath = `${contributePath}/${names.zkeys}`
const transcriptsPath = `${contributePath}/${names.transcripts}`
const attestationPath = `${contributePath}/${names.attestation}`

export const paths = {
  outputPath,
  setupPath,
  contributePath,
  potPath,
  zkeysPath,
  metadataPath,
  contributionsPath,
  transcriptsPath,
  attestationPath
}

/** Firebase */
export const collections = {
  users: "users",
  participants: "participants",
  ceremonies: "ceremonies",
  circuits: "circuits",
  contributions: "contributions"
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
