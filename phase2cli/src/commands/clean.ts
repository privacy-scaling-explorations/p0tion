#!/usr/bin/env node

import { emojis, paths, symbols, theme } from "../lib/constants.js"
import { showError } from "../lib/errors.js"
import { deleteDir, directoryExists } from "../lib/files.js"
import { askForConfirmation } from "../lib/prompts.js"
import { bootstrapCommandExec, customSpinner, sleep } from "../lib/utils.js"

/**
 * Clean command.
 */
const clean = async () => {
  try {
    // Initialize services.
    await bootstrapCommandExec()

    if (directoryExists(paths.outputPath)) {
      console.log(theme.bold(`${symbols.warning} Be careful, this action is irreversible!`))

      const { confirmation } = await askForConfirmation(
        "Are you sure you want to continue with the clean up?",
        "Yes",
        "No"
      )

      if (confirmation) {
        const spinner = customSpinner(`Cleaning up...`, "clock")
        spinner.start()

        // Do the clean up.
        deleteDir(paths.outputPath)
        await sleep(1500)

        spinner.stop()

        console.log(`${symbols.success} Done ${emojis.broom}`)
      }
    } else {
      console.log(`${symbols.info} There is nothing to clean ${emojis.eyes}`)
    }
  } catch (err: any) {
    showError(`Something went wrong: ${err.toString()}`, true)
  }
}

export default clean
