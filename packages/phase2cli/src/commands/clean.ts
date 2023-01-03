#!/usr/bin/env node

import { deleteDir, directoryExists } from "@zkmpc/actions"
import { emojis, paths, symbols, theme } from "../lib/constants"
import { showError } from "../lib/errors"
import { askForConfirmation } from "../lib/prompts"
import { bootstrapCommandExec, customSpinner, sleep } from "../lib/utils"

/**
 * Clean command.
 */
const clean = async () => {
    try {
        // Initialize services.
        await bootstrapCommandExec()

        const spinner = customSpinner(`Cleaning up...`, "clock")

        if (directoryExists(paths.outputPath)) {
            console.log(theme.bold(`${symbols.warning} Be careful, this action is irreversible!`))

            const { confirmation } = await askForConfirmation(
                "Are you sure you want to continue with the clean up?",
                "Yes",
                "No"
            )

            if (confirmation) {
                spinner.start()

                // Do the clean up.
                deleteDir(paths.outputPath)

                // nb. simulate waiting time for 1s.
                await sleep(1000)

                spinner.succeed(`Cleanup was successfully completed ${emojis.broom}`)
            }
        } else {
            console.log(`${symbols.info} There is nothing to clean ${emojis.eyes}`)
        }
    } catch (err: any) {
        showError(`Something went wrong: ${err.toString()}`, true)
    }
}

export default clean
