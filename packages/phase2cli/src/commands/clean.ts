#!/usr/bin/env node

import { bootstrapCommandExecutionAndServices } from "../lib/services"
import { showError } from "../lib/errors"
import { askForConfirmation } from "../lib/prompts"
import { customSpinner, sleep } from "../lib/utils"
import theme from "../lib/theme"
import { localPaths } from "../lib/localConfigs"
import { deleteDir, directoryExists } from "../lib/files"

/**
 * Clean command.
 */
const clean = async () => {
    try {
        // Initialize services.
        await bootstrapCommandExecutionAndServices()

        const spinner = customSpinner(`Cleaning up...`, "clock")

        if (directoryExists(localPaths.output)) {
            console.log(theme.text.bold(`${theme.symbols.warning} Be careful, this action is irreversible!`))

            const { confirmation } = await askForConfirmation(
                "Are you sure you want to continue with the clean up?",
                "Yes",
                "No"
            )

            if (confirmation) {
                spinner.start()

                // Do the clean up.
                deleteDir(localPaths.output)

                // nb. simulate waiting time for 1s.
                await sleep(1000)

                spinner.succeed(`Cleanup was successfully completed ${theme.emojis.broom}`)
            }
        } else {
            console.log(`${theme.symbols.info} There is nothing to clean ${theme.emojis.eyes}`)
        }
    } catch (err: any) {
        showError(`Something went wrong: ${err.toString()}`, true)
    }
}

export default clean
