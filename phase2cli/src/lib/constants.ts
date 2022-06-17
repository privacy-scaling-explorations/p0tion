import chalk from "chalk"
import logSymbols from "log-symbols"
import emoji from "node-emoji"

export const theme = {
  yellow: chalk.yellow,
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
  wave: emoji.get("wave")
}

export const ptauDownloadUrlTemplate = `https://hermez.s3-eu-west-1.amazonaws.com/`
export const ptauFilenameTemplate = `powersOfTau28_hez_final_`
