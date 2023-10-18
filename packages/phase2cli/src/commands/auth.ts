#!/usr/bin/env node
import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device"
import { Verification } from "@octokit/auth-oauth-device/dist-types/types.js"
import clipboard from "clipboardy"
import dotenv from "dotenv"
import open from "open"
import figlet from "figlet"
import { fileURLToPath } from "url"
import { dirname } from "path"
import { GENERIC_ERRORS, showError } from "../lib/errors.js"
import { checkLocalAccessToken, getLocalAccessToken, setLocalAccessToken } from "../lib/localConfigs.js"
import { bootstrapCommandExecutionAndServices, signInToFirebase } from "../lib/services.js"
import theme from "../lib/theme.js"
import {
    customSpinner,
    exchangeGithubTokenForCredentials,
    getGithubProviderUserId,
    getUserHandleFromProviderUserId,
    sleep,
    terminate
} from "../lib/utils.js"

const packagePath = `${dirname(fileURLToPath(import.meta.url))}`
dotenv.config({
    path: packagePath.includes(`src/lib`)
        ? `${dirname(fileURLToPath(import.meta.url))}/../../.env`
        : `${dirname(fileURLToPath(import.meta.url))}/.env`
})

/**
 * Custom countdown which throws an error when expires.
 * @param expirationInSeconds <number> - the expiration time in seconds.
 */
export const expirationCountdownForGithubOAuth = (expirationInSeconds: number) => {
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
    // Copy code to clipboard.
    clipboard.writeSync(verification.user_code)
    clipboard.readSync()

    // Display data.
    console.log(
        `${theme.symbols.warning} Visit ${theme.text.bold(
            theme.text.underlined(verification.verification_uri)
        )} on this device to generate a new token and authenticate\n`
    )

    console.log(theme.colors.magenta(figlet.textSync("Code is Below", { font: "ANSI Shadow" })), "\n")

    console.log(
        `${theme.symbols.info} Your auth code: ${theme.text.bold(
            verification.user_code
        )} has been copied to your clipboard (${theme.emojis.clipboard} ${theme.symbols.success})\n`
    )

    const spinner = customSpinner(`Redirecting to Github...`, `clock`)
    spinner.start()

    await sleep(10000) // ~10s to make users able to read the CLI.

    // Automatically open the page (# Step 2).
    await open(verification.verification_uri)

    spinner.stop()

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

    // Console more context for the user.
    console.log(
        `${theme.symbols.info} ${theme.text.bold(
            `You are about to authenticate on this CLI using your Github account (device flow - OAuth 2.0 mechanism).\n${
                theme.symbols.warning
            } Please, note that only read and write permission for ${theme.text.italic(
                `gists`
            )} will be required in order to publish your contribution transcript!`
        )}\n`
    )

    const spinner = customSpinner(`Checking authentication token...`, `clock`)
    spinner.start()

    await sleep(5000)

    // Manage OAuth Github token.
    const isLocalTokenStored = checkLocalAccessToken()

    if (!isLocalTokenStored) {
        spinner.fail(`No local authentication token found\n`)

        // Generate a new access token using Github Device Flow (OAuth 2.0).
        const newToken = await executeGithubDeviceFlow(String(process.env.AUTH_GITHUB_CLIENT_ID))

        // Store the new access token.
        setLocalAccessToken(newToken)
    } else spinner.succeed(`Local authentication token found\n`)

    // Get access token from local store.
    const token = getLocalAccessToken()

    // Exchange token for credential.
    const credentials = exchangeGithubTokenForCredentials(String(token))

    spinner.text = `Authenticating...`
    spinner.start()

    // Sign-in to Firebase using credentials.
    await signInToFirebase(firebaseApp, credentials)

    // Get Github handle.
    const providerUserId = await getGithubProviderUserId(String(token))

    spinner.succeed(
        `You are authenticated as ${theme.text.bold(
            `@${getUserHandleFromProviderUserId(providerUserId)}`
        )} and now able to interact with zk-SNARK Phase2 Trusted Setup ceremonies`
    )

    // Console more context for the user.
    console.log(
        `\n${theme.symbols.warning} You can always log out by running the ${theme.text.bold(
            `phase2cli logout`
        )} command`
    )

    terminate(providerUserId)
}

export default auth
