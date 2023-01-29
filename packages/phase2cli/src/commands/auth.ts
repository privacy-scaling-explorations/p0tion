#!/usr/bin/env node
import dotenv from "dotenv"
import { symbols, theme } from "../lib/constants"
import { exchangeGithubTokenForCredentials, getGithubUserHandle, terminate } from "../lib/utils"
import { bootstrapCommandExecutionAndServices } from "../lib/commands"
import { executeGithubDeviceFlow, signInToFirebase } from "../lib/authorization"
import { checkLocalAccessToken, getLocalAccessToken, setLocalAccessToken } from "../lib/localStorage"

dotenv.config()

/**
 * Auth command.
 * @notice The auth command allows a user to make the association of their Github account with the CLI by leveraging OAuth 2.0 as an authentication mechanism.
 * @dev Under the hood, the command handles a manual Device Flow following the guidelines in the Github documentation.
 */
const auth = async () => {
    const { firebaseApp } = await bootstrapCommandExecutionAndServices()

    // Manage OAuth Github token.
    const isLocalTokenStored = checkLocalAccessToken()

    if (!isLocalTokenStored) {
        // Generate a new access token using Github Device Flow (OAuth 2.0).
        const newToken = await executeGithubDeviceFlow(String(process.env.GITHUB_CLIENT_ID))

        // Store the new access token.
        setLocalAccessToken(newToken)
    }

    // Get access token from local store.
    const token = getLocalAccessToken()

    // Exchange token for credential.
    const credentials = exchangeGithubTokenForCredentials(String(token))

    // Sign-in to Firebase using credentials.
    await signInToFirebase(firebaseApp, credentials)

    // Get Github handle.
    const githubUserHandle = await getGithubUserHandle(String(token))

    console.log(`${symbols.success} You are authenticated as ${theme.bold(`@${githubUserHandle}`)}`)
    console.log(
        `${symbols.info} You are now able to compute contributions for zk-SNARK Phase2 Trusted Setup opened ceremonies`
    )

    terminate(githubUserHandle)
}

export default auth
