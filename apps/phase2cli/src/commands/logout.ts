#!/usr/bin/env node

import { getAuth, signOut } from "firebase/auth"
import { deleteStoredOAuthToken, handleAuthUserSignIn } from "../lib/auth.js"
import { emojis, symbols, theme } from "../lib/constants.js"
import { showError } from "../lib/errors.js"
import { askForConfirmation } from "../lib/prompts.js"
import { bootstrapCommandExec, customSpinner } from "../lib/utils.js"

/**
 * Logout command.
 */
const logout = async () => {
  try {
    // Initialize services.
    const { firebaseApp } = await bootstrapCommandExec()

    // Handle authenticated user sign in.
    // const { user, ghToken, ghUsername } = await handleAuthUserSignIn()
    await handleAuthUserSignIn(firebaseApp)

    // Inform the user about deassociation in Github and re run auth
    console.log(
      `${symbols.warning} We do not use any Github access token for authentication; thus we cannot revoke the authorization from your Github account for this CLI application`
    )
    console.log(
      `${symbols.info} You can do this manually as reported in the official Github documentation ${
        emojis.pointDown
      }\n\n${theme.bold(
        theme.underlined(
          `https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/reviewing-your-authorized-applications-oauth`
        )
      )}\n`
    )

    // Ask for confirmation.
    const { confirmation } = await askForConfirmation("Are you sure you want to log out?", "Yes", "No")

    if (confirmation) {
      const spinner = customSpinner(`Logging out...`, "clock")
      spinner.start()

      // Sign out.
      const auth = getAuth()
      await signOut(auth)

      // Delete local token.
      deleteStoredOAuthToken()

      spinner.stop()
      console.log(`${symbols.success} Logout successfully completed ${emojis.wave}`)
    }
  } catch (err: any) {
    showError(`Something went wrong: ${err.toString()}`, true)
  }
}

export default logout
