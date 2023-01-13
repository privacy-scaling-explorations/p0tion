#!/usr/bin/env node
import dotenv from "dotenv"
import { signInToFirebaseWithCredentials } from "@zkmpc/actions"
import { symbols, theme } from "../lib/constants"
import { exchangeGithubTokenForCredentials, getGithubUserHandle, terminate } from "../lib/utils"
import { bootstrapCommandExecutionAndServices } from "../lib/commands"
import { FIREBASE_ERRORS, GITHUB_ERRORS, showError } from "../lib/errors"
import { executeGithubDeviceFlow } from "../lib/authorization"
import {
    checkLocalAccessToken,
    deleteLocalAccessToken,
    getLocalAccessToken,
    setLocalAccessToken
} from "../lib/localStorage"

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

    try {
        // Sign in with credentials to Firebase.
        await signInToFirebaseWithCredentials(firebaseApp, credentials)
    } catch (error: any) {
        // Error handling by parsing error message.
        if (error.toString().includes("Firebase: Unsuccessful check authorization response from Github")) {
            showError(FIREBASE_ERRORS.FIREBASE_TOKEN_EXPIRED_REMOVED_PERMISSIONS, false)

            // Clean expired access token from local storage.
            deleteLocalAccessToken()

            // Inform user.
            console.log(
                `${symbols.info} We have successfully removed your local token to make you able to repeat the authorization process once again. Please, run the auth command again whenever you are ready and complete the association with the CLI application.`
            )

            // Gracefully exit.
            process.exit(0)
        }

        if (error.toString().includes("Firebase: Error (auth/user-disabled)"))
            showError(FIREBASE_ERRORS.FIREBASE_USER_DISABLED, true)

        if (
            error
                .toString()
                .includes("Firebase: Remote site 5XX from github.com for VERIFY_CREDENTIAL (auth/invalid-credential)")
        )
            showError(FIREBASE_ERRORS.FIREBASE_FAILED_CREDENTIALS_VERIFICATION, true)

        if (error.toString().includes("Firebase: Error (auth/network-request-failed)"))
            showError(FIREBASE_ERRORS.FIREBASE_NETWORK_ERROR, true)

        if (error.toString().includes("HttpError: The authorization request was denied"))
            showError(GITHUB_ERRORS.GITHUB_ACCOUNT_ASSOCIATION_REJECTED, true)

        if (
            error
                .toString()
                .includes(
                    "HttpError: request to https://github.com/login/device/code failed, reason: connect ETIMEDOUT"
                )
        )
            showError(GITHUB_ERRORS.GITHUB_SERVER_TIMEDOUT, true)
    }

    // Get Github handle.
    const githubUserHandle = await getGithubUserHandle(String(token))

    console.log(`${symbols.success} You are authenticated as ${theme.bold(`@${githubUserHandle}`)}`)
    console.log(
        `${symbols.info} You are now able to compute contributions for zk-SNARK Phase2 Trusted Setup opened ceremonies`
    )

    terminate(githubUserHandle)
}

export default auth
