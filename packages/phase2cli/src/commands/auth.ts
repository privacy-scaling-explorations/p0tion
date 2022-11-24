#!/usr/bin/env node

import { getNewOAuthTokenUsingGithubDeviceFlow, signInToFirebaseWithGithubToken } from "@zkmpc/actions"
import dotenv from "dotenv"
import { emojis, symbols, theme } from "../lib/constants"
import { FIREBASE_ERRORS, GITHUB_ERRORS, showError } from "../lib/errors"
import { bootstrapCommandExec, getGithubUsername, terminate } from "../lib/utils"
import { getStoredOAuthToken, hasStoredOAuthToken, setStoredOAuthToken } from "../lib/auth"

dotenv.config()

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
        if (!process.env.GITHUB_CLIENT_ID) showError(GITHUB_ERRORS.GITHUB_NOT_CONFIGURED_PROPERLY, true)

        // Request a new token.
        token = await getNewOAuthTokenUsingGithubDeviceFlow(process.env.GITHUB_CLIENT_ID)

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
    console.log(process.env.GITHUB_CLIENT_ID)

    try {
        const { firebaseApp } = await bootstrapCommandExec()

        if (!process.env.GITHUB_CLIENT_ID) showError(GITHUB_ERRORS.GITHUB_NOT_CONFIGURED_PROPERLY, true)

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
        const error = err.toString()

        /** Firebase */

        if (error.includes("Firebase: Unsuccessful check authorization response from Github")) {
            showError(FIREBASE_ERRORS.FIREBASE_TOKEN_EXPIRED_REMOVED_PERMISSIONS, false)

            // Clean expired token from local storage.
            // deleteStoredOAuthToken()

            console.log(`${symbols.success} Removed expired token from your local storage ${emojis.broom}`)
            console.log(
                `${symbols.info} Please, run \`phase2cli auth\` again to generate a new token and associate your Github account`
            )

            process.exit(0)
        }

        if (error.includes("Firebase: Firebase App named '[DEFAULT]' already exists with different options or config"))
            showError(FIREBASE_ERRORS.FIREBASE_DEFAULT_APP_DOUBLE_CONFIG, true)

        if (error.includes("Firebase: Error (auth/user-disabled)"))
            showError(FIREBASE_ERRORS.FIREBASE_USER_DISABLED, true)

        if (error.includes("Firebase: Error (auth/network-request-failed)"))
            showError(FIREBASE_ERRORS.FIREBASE_NETWORK_ERROR, true)

        if (error.includes("Firebase: Remote site 5XX from github.com for VERIFY_CREDENTIAL (auth/invalid-credential)"))
            showError(FIREBASE_ERRORS.FIREBASE_FAILED_CREDENTIALS_VERIFICATION, true)

        /** Github */

        if (error.includes("HttpError: The authorization request was denied"))
            showError(GITHUB_ERRORS.GITHUB_ACCOUNT_ASSOCIATION_REJECTED, true)

        if (
            error.includes(
                "HttpError: request to https://github.com/login/device/code failed, reason: connect ETIMEDOUT"
            )
        )
            showError(GITHUB_ERRORS.GITHUB_SERVER_TIMEDOUT, true)

        /** Generic */

        showError(`Something went wrong: ${error}`, true)
    }
}

export default auth
