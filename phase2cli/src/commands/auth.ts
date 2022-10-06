#!/usr/bin/env node

import { theme, symbols } from "../lib/constants.js"
import { signIn, getOAuthToken, getStoredOAuthToken, setStoredOAuthToken, hasStoredOAuthToken } from "../lib/auth.js"
import { getGithubUsername, bootstrapCommandExec, terminate } from "../lib/utils.js"
import { GITHUB_ERRORS, handleAuthErrors, showError } from "../lib/errors.js"
import { readLocalJsonFile } from "../lib/files.js"

// Get local configs.
const { github } = readLocalJsonFile("../../env.json")

/**
 * Look for the Github 2.0 OAuth token in the local storage if present; otherwise manage the request for a new token.
 * @returns <Promise<string>>
 */
const handleGithubToken = async (): Promise<string> => {
  let token: string

  if (hasStoredOAuthToken())
    // Get stored token.
    token = String(getStoredOAuthToken())
  else {
    if (!github.GITHUB_CLIENT_ID) showError(GITHUB_ERRORS.GITHUB_NOT_CONFIGURED_PROPERLY, true)

    // Request a new token.
    token = await getOAuthToken(github.GITHUB_CLIENT_ID)

    // Store the new token.
    setStoredOAuthToken(token)
  }

  return token
}

/**
 * Auth command.
 */
const auth = async () => {
  try {
    await bootstrapCommandExec()

    // Manage OAuth Github token.
    const ghToken = await handleGithubToken()

    // Sign in with credentials.
    await signIn(ghToken)

    // Get Github username.
    const ghUsername = await getGithubUsername(ghToken)

    console.log(`${symbols.success} You are authenticated as ${theme.bold(`@${ghUsername}`)}`)
    console.log(
      `${
        symbols.info
      } You can now contribute to zk-SNARK Phase2 Trusted Setup running ceremonies by running ${theme.bold(
        theme.italic(`phase2cli contribute`)
      )} command`
    )

    terminate(ghUsername)
  } catch (err: any) {
    handleAuthErrors(err)
  }
}

export default auth
