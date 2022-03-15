import chalk from "chalk"

/** Chalk custom theme */
export default {
  /** Header */
  title: chalk.bold.yellowBright,
  subtitle: chalk.yellow,

  /** Feedbacks */
  ok: chalk.bold.green,
  error: chalk.bold.red,
  warning: chalk.hex("#FFA500")
}
