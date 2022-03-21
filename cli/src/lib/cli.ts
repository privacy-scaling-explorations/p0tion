import open from "open"
import logSymbols from "log-symbols"
import { User } from "firebase/auth"
import Configstore from "configstore"
import theme from "./theme.js"
import { promptForAfterLoginMenu, promptHelpOAuthMenu, promptOAuthConfirmation } from "./prompts.js"
import { exchangeDeviceCodeWithFirebase, getGithubOAuthCodes } from "./github.js"

/**
 * Device Flow Github OAuth and Firebase token handshake process.
 * @param clientId <string> - the Github OAuth app client id.
 * @returns <Promise<string>> - the Firebase token necessary for sign in w/ Github credentials to Firebase.
 */
export const handleCLILogin = async (clientId: string): Promise<string> => {
  /**
   * Device Flow Github OAuth + Firebase handshake (for registration (first access) and refresh).
   * # Step 1: Request device and user verification codes and gets auth verification uri.
   * # Step 2: The app prompts the user to enter a user verification code at https://github.com/login/device.
   * # Step 3: The app polls/asks for the user authentication status.
   * # Step 4: Exchange the device code from GitHub's OAuth Device Flow for OAuth Apps with Firebase.
   */

  // # Step 1.
  const githubOAuthCodes = await getGithubOAuthCodes(clientId)
  console.log(theme.violetD(theme.bold(`\n# Step 1 - Requesting device and user verification codes `)))
  console.log(theme.monoD(theme.underlined(`\nYour Code`), "->", theme.acquaD(theme.bold(githubOAuthCodes.userCode))))
  console.log(
    theme.monoD(`\nExpires in ${theme.yellowD(Math.round((githubOAuthCodes.expiresIn + 1) / 60))} minutes!!!`)
  )

  // # Step 2.
  console.log(
    theme.violetD(
      theme.bold(
        `\n# Step 2 - Navigate to ${theme.underlined(
          theme.bold("https://github.com/login/device")
        )} and insert the code 💻 `
      )
    )
  )
  console.log(
    theme.monoD(
      theme.italic(
        ` ${logSymbols.info} the page should open automatically in your default web browser. Otherwise, navigate on the link above.`
      )
    )
  )

  open("https://github.com/login/device")

  // # Step 3.
  const confirmed = await promptOAuthConfirmation()

  if (!confirmed) await promptHelpOAuthMenu()

  // # Step 4.
  console.log(
    theme.violetD(
      theme.bold("\n# Step 4 - Exchange the device code from GitHub's OAuth Device Flow for OAuth Apps with Firebase")
    )
  )

  return exchangeDeviceCodeWithFirebase(clientId, githubOAuthCodes.deviceCode)
}

/**
 * Handle the core after-login logic of the CLI application.
 * @param user <User> - the authenticated user object.
 * @param configStore <Configstore> - the local config storage.
 * @returns <Promise<any>>
 */
export const handleAfterLogin = async (user: User, configStore: Configstore): Promise<any> => {
  if (user.displayName) {
    await promptForAfterLoginMenu(configStore, user.displayName)
  }

  return true
}
