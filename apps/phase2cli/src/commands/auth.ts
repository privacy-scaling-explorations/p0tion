#!/usr/bin/env node

import { getNewOAuthTokenUsingGithubDeviceFlow, signInToFirebaseWithGithubToken } from "@zkmpc/actions"
import { symbols, theme } from "../lib/constants.js"
import { GITHUB_ERRORS, handleAuthErrors, showError } from "../lib/errors.js"
import { bootstrapCommandExec, getGithubUsername, terminate } from "../lib/utils.js"
import { readLocalJsonFile } from "../lib/files.js"
import { getStoredOAuthToken, hasStoredOAuthToken, setStoredOAuthToken } from "../lib/auth.js"

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
    token = await getNewOAuthTokenUsingGithubDeviceFlow(github.GITHUB_CLIENT_ID)

    // Store the new token.
    setStoredOAuthToken(token)
  }

  return token
}

/**
 * Auth command.
 * @dev TODO: add docs.
 */
const auth = async () => {
  try {
    const { firebaseApp } = await bootstrapCommandExec()

    if (!github.GITHUB_CLIENT_ID) showError(GITHUB_ERRORS.GITHUB_NOT_CONFIGURED_PROPERLY, true)

    // Manage OAuth Github token.
    const token = await handleGithubToken()

    // Sign in with credentials.
    await signInToFirebaseWithGithubToken(firebaseApp, token)

    // Get Github username.
    const ghUsername = await getGithubUsername(token)

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
