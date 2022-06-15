import chalk from "chalk"
import logSymbols from "log-symbols"

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
