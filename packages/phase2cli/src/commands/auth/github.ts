import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device"
import clipboard from "clipboardy"
import open from "open"
import dotenv from "dotenv"
import figlet from "figlet"
import { Verification } from "@octokit/auth-oauth-device/dist-types/types.js"
import jwt from "jsonwebtoken"
import { dirname } from "path"
import { fileURLToPath } from "url"
import { User } from "../../types/index.js"
import getGithubUser from "../../lib-api/auth.js"
import { GENERIC_ERRORS, showError } from "../../lib/errors.js"
import theme from "../../lib/theme.js"
import { customSpinner, sleep, terminate } from "../../lib/utils.js"
import { checkJWTToken, getJWTToken, setJWTToken, setLocalAuthMethod } from "../../lib/localConfigs.js"

const packagePath = `${dirname(fileURLToPath(import.meta.url))}`
dotenv.config({
    path: packagePath.includes(`src/lib`)
        ? `${dirname(fileURLToPath(import.meta.url))}/../../.env`
        : `${dirname(fileURLToPath(import.meta.url))}/.env`
})

export const expirationCountdownForGithubOAuth = (expirationInSeconds: number) => {
    // Prepare data.
    let secondsCounter = expirationInSeconds <= 60 ? expirationInSeconds : 60
    const interval = 1 // 1s

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

export const onVerification = async (verification: Verification): Promise<void> => {
    // Copy code to clipboard.
    let noClipboard = false
    try {
        clipboard.writeSync(verification.user_code)
        clipboard.readSync()
    } catch (error) {
        noClipboard = true
    }

    // Display data.
    console.log(
        `${theme.symbols.warning} Visit ${theme.text.bold(
            theme.text.underlined(verification.verification_uri)
        )} on this device to generate a new token and authenticate\n`
    )

    console.log(theme.colors.magenta(figlet.textSync("Code is Below", { font: "ANSI Shadow" })), "\n")

    const message = !noClipboard ? `has been copied to your clipboard (${theme.emojis.clipboard})` : ``
    console.log(
        `${theme.symbols.info} Your auth code: ${theme.text.bold(verification.user_code)} ${message} ${
            theme.symbols.success
        }\n`
    )

    const spinner = customSpinner(`Redirecting to Github...`, `clock`)
    spinner.start()

    await sleep(10000) // ~10s to make users able to read the CLI.

    try {
        // Automatically open the page (# Step 2).
        await open(verification.verification_uri)
    } catch (error: any) {
        console.log(`${theme.symbols.info} Please authenticate via GitHub at ${verification.verification_uri}`)
    }

    spinner.stop()

    // Countdown for time expiration.
    expirationCountdownForGithubOAuth(verification.expires_in)
}

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

const github = async () => {
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

    const isJWTTokenStored = checkJWTToken()
    if (!isJWTTokenStored) {
        spinner.fail(`No local authentication token found\n`)
        // Generate a new access token using Github Device Flow (OAuth 2.0).
        const newToken = await executeGithubDeviceFlow(String(process.env.AUTH_GITHUB_CLIENT_ID))
        const { jwt: jwtToken } = await getGithubUser(newToken)

        // Store the new access token.
        setLocalAuthMethod("github")
        setJWTToken(jwtToken)
    } else {
        spinner.succeed(`Local authentication token found\n`)
    }

    // Get access token from local store.
    const token = getJWTToken() as string
    const decode = jwt.decode(token) as { user: User; exp: number; iat: number }
    const { user } = decode

    spinner.text = `Authenticating...`
    spinner.start()

    spinner.succeed(
        `You are authenticated as ${theme.text.bold(
            `@${user.displayName}`
        )} and now able to interact with zk-SNARK Phase2 Trusted Setup ceremonies`
    )

    // Console more context for the user.
    console.log(
        `\n${theme.symbols.warning} You can always log out by running the ${theme.text.bold(
            `phase2cli logout`
        )} command`
    )

    terminate(user.displayName)
}

export default github
