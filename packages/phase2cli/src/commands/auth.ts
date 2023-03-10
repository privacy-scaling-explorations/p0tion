#!/usr/bin/env node
import dotenv from "dotenv"
import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device"
import { Verification } from "@octokit/auth-oauth-device/dist-types/types"
import clipboard from "clipboardy"
import open from "open"
import {
    exchangeGithubTokenForCredentials,
    getGithubProviderUserId,
    getUserHandleFromProviderUserId,
    terminate
} from "../lib/utils"
import { bootstrapCommandExecutionAndServices, signInToFirebase } from "../lib/services"
import theme from "../lib/theme"
import { checkLocalAccessToken, getLocalAccessToken, setLocalAccessToken } from "../lib/localConfigs"
import { showError, GENERIC_ERRORS } from "../lib/errors"

dotenv.config()

/**
 * Custom countdown which throws an error when expires.
 * @param expirationInSeconds <number> - the expiration time in seconds.
 */
const expirationCountdownForGithubOAuth = (expirationInSeconds: number) => {
    // Prepare data.
    let secondsCounter = expirationInSeconds <= 60 ? expirationInSeconds : 60
    const interval = 1 // 1s.

    setInterval(() => {
        if (expirationInSeconds !== 0) {
            // Update time and seconds counter.
            expirationInSeconds -= interval
            secondsCounter -= interval

            if (secondsCounter % 60 === 0) secondsCounter = 0

            // Notify user.
            process.stdout.write(
                `${theme.symbols.warning} Expires in ${theme.text.bold(
                    theme.colors.magenta(`00:${Math.floor(expirationInSeconds / 60)}:${secondsCounter}`)
                )}\r`
            )
        } else {
            process.stdout.write(`\n\n`) // workaround to \r.
            showError(GENERIC_ERRORS.GENERIC_COUNTDOWN_EXPIRATION, true)
        }
    }, interval * 1000) // ms.
}

/**
 * Callback to manage the data requested for Github OAuth2.0 device flow.
 * @param verification <Verification> - the data from Github OAuth2.0 device flow.
 */
export const onVerification = async (verification: Verification): Promise<void> => {
    // Automatically open the page (# Step 2).
    await open(verification.verification_uri)

    // Copy code to clipboard.
    clipboard.writeSync(verification.user_code)
    clipboard.readSync()

    // Display data.
    console.log(
        `${theme.symbols.warning} Visit ${theme.text.bold(
            theme.text.underlined(verification.verification_uri)
        )} on this device to authenticate`
    )
    console.log(
        `${theme.symbols.info} Your auth code: ${theme.text.bold(verification.user_code)} (${theme.emojis.clipboard} ${
            theme.symbols.success
        })\n`
    )

    // Countdown for time expiration.
    expirationCountdownForGithubOAuth(verification.expires_in)
}

/**
 * Return the Github OAuth 2.0 token using manual Device Flow authentication process.
 * @param clientId <string> - the client id for the CLI OAuth app.
 * @returns <string> the Github OAuth 2.0 token.
 */
export const executeGithubDeviceFlow = async (clientId: string): Promise<string> => {
    /**
     * Github OAuth 2.0 Device Flow.
     * # Step 1: Request device and user verification codes and gets auth verification uri.
     * # Step 2: The app prompts the user to enter a user verification code at https://github.com/login/device.
     * # Step 3: The app polls/asks for the user authentication status.
     */

    const clientType = "oauth-app"
    const tokenType = "oauth"

    // # Step 1.
    const auth = createOAuthDeviceAuth({
        clientType,
        clientId,
        scopes: ["gist"],
        onVerification
    })

    // # Step 3.
    const { token } = await auth({
        type: tokenType
    })

    return token
}

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
        const newToken = await executeGithubDeviceFlow(String(process.env.AUTH_GITHUB_CLIENT_ID))

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
    const providerUserId = await getGithubProviderUserId(String(token))

    console.log(
        `${theme.symbols.success} You are authenticated as ${theme.text.bold(
            `@${getUserHandleFromProviderUserId(providerUserId)}`
        )}`
    )
    console.log(
        `${theme.symbols.info} You are now able to compute contributions for zk-SNARK Phase2 Trusted Setup opened ceremonies`
    )

    terminate(providerUserId)
}

export default auth
