#!/usr/bin/env node

import clear from "clear"
import figlet from "figlet"
import dotenv from "dotenv"
import theme from "../lib/theme.js"

import { signIn, getOAuthToken, getStoredOAuthToken, setStoredOAuthToken, deleteStoredOAuthToken } from "../lib/auth.js"
import { initServices } from "../lib/firebase.js"
import { getGithubUsername } from "../lib/utils.js"

dotenv.config()

/**
 * Request the Github OAuth 2.0 token (manual Device Flow) or return if already stored locally.
 * @returns <Promise<string>> - the Github OAuth 2.0 token.
 */
const getGithubToken = async (): Promise<string> => {
  // Check if stored locally.
  const ghToken = getStoredOAuthToken()

  if (ghToken) return ghToken

  // Github.
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET)
    throw new Error("\nPlease, check that all GITHUB_ variables in the .env file are set correctly.")

  const { token } = await getOAuthToken(process.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_SECRET)

  // Store.
  setStoredOAuthToken(token)

  console.log(`${theme.success} Github OAuth 2.0 Token`)

  return token
}

/**
 * Login command.
 */
async function login() {
  clear()

  console.log(theme.yellowD(figlet.textSync("MPC Phase2 Suite", { font: "ANSI Shadow", horizontalLayout: "full" })))

  /** CORE */
  try {
    // Initialize services.
    await initServices()

    // Get/Set OAuth Token.
    const ghToken = await getGithubToken()

    // Sign in.
    // const { user } = await signIn(ghToken)
    await signIn(ghToken)
    // TODO: refactor after prepare changes!
    // Get user role from Firestore (nb. this should be done after Cloud Function).
    // const role = await getUserRoleFromDb(user.uid)

    // Get user Github username.
    const ghUsername = await getGithubUsername(ghToken)

    console.log(theme.monoD(`${theme.success} Greetings, @${theme.bold(ghUsername)}!`))

    process.exit(0)
  } catch (err: any) {
    // TODO: improve error handling.
    // TODO: fix process.exit(1) twice (nb. could be related with commander pkg).
    if (err) {
      const error = err.toString()

      /** Firebase */
      if (error.includes("Firebase: Firebase App named '[DEFAULT]' already exists with different options or config")) {
        console.error(
          `\n${theme.error} Oops, it would look like there are two configurations for the same Firebase app. Please check and try again.`
        )
        process.exit(1)
      }

      if (error.includes("Firebase: Unsuccessful check authorization response from Github")) {
        console.error(
          `\n${theme.error} Oops, probably your token has been expired or you have removed the Github association for your account with this CLI.`
        )

        // Clean expired token from local storage.
        deleteStoredOAuthToken()

        console.log(`\n ${theme.success} Storage clean 🧹`)
        console.log(theme.bold(`\nTo generate a new token, please run \`phase2cli login\` again.`))

        process.exit(1)
      }

      if (error.includes("Firebase: Error (auth/user-disabled)")) {
        console.error(
          `\n${theme.error} Oops, it would appear that your Github account has been disabled by a Coordinator! Please, reach the team for more information`
        )
        process.exit(1)
      }

      if (error.includes("Firebase: Remote site 5XX from github.com for VERIFY_CREDENTIAL (auth/invalid-credential)")) {
        console.error(
          `\n${theme.error} Oops, Firebase can't verify your Github credentials! This typically happens due to a network error. Check your connection and try again.`
        )
        process.exit(1)
      }

      /** Github */
      if (error.includes("HttpError: The authorization request was denied")) {
        console.error(
          `\n\n${theme.error} Oops, it looks like you have refused to associate the CLI with your Github account! You must confirm in order to participate in the ceremony. Please, restart the CLI to repeat the OAuth 2.0 process`
        )
        process.exit(1)
      }

      if (
        error.includes("HttpError: request to https://github.com/login/device/code failed, reason: connect ETIMEDOUT")
      ) {
        console.error(
          `\n\n${theme.error} Oops, It appears that the Github server has timed out! This typically happens due to a network error or Github server downtime. Check your connection and try again.`
        )
        process.exit(1)
      }

      /** Generic */
      console.error(`\n${theme.error} Oops, something went wrong: \n${error}`)
      process.exit(1)
      // TODO: find a more graceful method to stop/exit for process.exit(1).
      // ref. https://nodejs.dev/learn/how-to-exit-from-a-nodejs-program.
    }
  }
}

export default login
