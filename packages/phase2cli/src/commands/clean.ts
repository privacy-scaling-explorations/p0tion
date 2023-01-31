#!/usr/bin/env node

import { deleteDir, directoryExists } from "@zkmpc/actions"
import { bootstrapCommandExecutionAndServices } from "../lib/commands"
import { emojis, symbols, theme } from "../lib/constants"
import { showError } from "../lib/errors"
import { askForConfirmation } from "../lib/prompts"
import { outputLocalFolderPath } from "../lib/paths"
import { customSpinner, sleep } from "../lib/utils"

/**
 * Clean command.
 */
const clean = async () => {
    try {
        // Initialize services.
        await bootstrapCommandExecutionAndServices()

        const spinner = customSpinner(`Cleaning up...`, "clock")

        if (directoryExists(outputLocalFolderPath)) {
            console.log(theme.bold(`${symbols.warning} Be careful, this action is irreversible!`))

            const { confirmation } = await askForConfirmation(
                "Are you sure you want to continue with the clean up?",
                "Yes",
                "No"
            )

            if (confirmation) {
                spinner.start()

                // Do the clean up.
                deleteDir(outputLocalFolderPath)

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
