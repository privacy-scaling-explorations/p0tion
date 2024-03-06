import open from "open"
import figlet from "figlet"
import clipboard from "clipboardy"
import fetch from "node-fetch"
import { getAuth, signInWithCustomToken } from "firebase/auth"
import { httpsCallable } from "firebase/functions"
import { commonTerms } from "@p0tion/actions"
import { showError } from "../lib/errors.js"
import { bootstrapCommandExecutionAndServices } from "../lib/services.js"
import theme from "../lib/theme.js"
import { customSpinner, sleep } from "../lib/utils.js"
import { CheckNonceOfSIWEAddressResponse, OAuthDeviceCodeResponse, OAuthTokenResponse } from "../types/index.js"
import {
    checkLocalAccessToken,
    deleteLocalAccessToken,
    getLocalAccessToken,
    setLocalAccessToken
} from "../lib/localConfigs.js"

const showVerificationCodeAndUri = async (OAuthDeviceCode: OAuthDeviceCodeResponse) => {
    // Copy code to clipboard.
    let noClipboard = false
    try {
        clipboard.writeSync(OAuthDeviceCode.user_code)
        clipboard.readSync()
    } catch (error) {
        noClipboard = true
    }
    // Display data.
    console.log(
        `${theme.symbols.warning} Visit ${theme.text.bold(
            theme.text.underlined(OAuthDeviceCode.verification_uri)
        )} on this device to generate a new token and authenticate\n`
    )
    console.log(theme.colors.magenta(figlet.textSync("Code is Below", { font: "ANSI Shadow" })), "\n")

    const message = !noClipboard ? `has been copied to your clipboard (${theme.emojis.clipboard})` : ``
    console.log(
        `${theme.symbols.info} Your auth code: ${theme.text.bold(OAuthDeviceCode.user_code)} ${message} ${
            theme.symbols.success
        }\n`
    )
    const spinner = customSpinner(`Redirecting to Github...`, `clock`)
    spinner.start()
    await sleep(10000) // ~10s to make users able to read the CLI.
    try {
        // Automatically open the page (# Step 2).
        await open(OAuthDeviceCode.verification_uri)
    } catch (error: any) {
        console.log(`${theme.symbols.info} Please authenticate via GitHub at ${OAuthDeviceCode.verification_uri}`)
    }
    spinner.stop()
}

/**
 * Return the token to sign in to Firebase after passing the SIWE Device Flow
 * @param clientId <string> - The client id of the Auth0 application.
 * @param firebaseFunctions <any> - The Firebase functions instance to call the cloud function
 * @returns <string> - The token to sign in to Firebase
 */
const executeSIWEDeviceFlow = async (clientId: string, firebaseFunctions: any): Promise<string> => {
    // Call Auth0 endpoint to request device code uri
    const OAuthDeviceCode = (await fetch(`${process.env.AUTH0_APPLICATION_URL}/oauth/device/code`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            client_id: clientId,
            scope: "openid",
            audience: `${process.env.AUTH0_APPLICATION_URL}/api/v2/`
        })
    }).then((_res) => _res.json())) as OAuthDeviceCodeResponse
    await showVerificationCodeAndUri(OAuthDeviceCode)
    // Poll Auth0 endpoint until you get token or request expires
    let isSignedIn = false
    let isExpired = false
    let auth0Token = ""
    while (!isSignedIn && !isExpired) {
        // Call Auth0 endpoint to request token
        const OAuthToken = (await fetch(`${process.env.AUTH0_APPLICATION_URL}/oauth/token`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                client_id: clientId,
                device_code: OAuthDeviceCode.device_code,
                grant_type: "urn:ietf:params:oauth:grant-type:device_code"
            })
        }).then((_res) => _res.json())) as OAuthTokenResponse
        if (OAuthToken.error) {
            if (OAuthToken.error === "authorization_pending") {
                // Wait for the user to sign in
                await sleep(OAuthDeviceCode.interval * 1000)
            } else if (OAuthToken.error === "slow_down") {
                // Wait for the user to sign in
                await sleep(OAuthDeviceCode.interval * 1000 * 2)
            } else if (OAuthToken.error === "expired_token") {
                // The user didn't sign in on time
                isExpired = true
            }
        } else {
            // The user signed in
            isSignedIn = true
            auth0Token = OAuthToken.access_token
        }
    }
    // Send token to cloud function to check nonce, create user and retrieve token
    const cf = httpsCallable(firebaseFunctions, commonTerms.cloudFunctionsNames.checkNonceOfSIWEAddress)
    const result = await cf({
        auth0Token
    })
    const { token, valid, message } = result.data as CheckNonceOfSIWEAddressResponse
    if (!valid) {
        showError(message, true)
    }
    return token
}

/**
 * Auth command using Sign In With Ethereum
 * @notice The auth command allows a user to make the association of their Ethereum account with the CLI by leveraging SIWE as an authentication mechanism.
 * @dev Under the hood, the command handles a manual Device Flow following the guidelines in the SIWE documentation.
 */
const authSIWE = async () => {
    try {
        const { firebaseFunctions } = await bootstrapCommandExecutionAndServices()
        // Console more context for the user.
        console.log(
            `${theme.symbols.info} ${theme.text.bold(
                `You are about to authenticate on this CLI using your Ethereum address (device flow - OAuth 2.0 mechanism).\n${theme.symbols.warning} Please, note that only a Sign-in With Ethereum signature will be required`
            )}\n`
        )
        const spinner = customSpinner(`Checking authentication token...`, `clock`)
        spinner.start()
        await sleep(5000)

        // Manage OAuth Github or SIWE token.
        const isLocalTokenStored = checkLocalAccessToken()

        if (!isLocalTokenStored) {
            spinner.fail(`No local authentication token found\n`)

            // Generate a new access token using Github Device Flow (OAuth 2.0).
            const newToken = await executeSIWEDeviceFlow(String(process.env.AUTH_SIWE_CLIENT_ID), firebaseFunctions)

            // Store the new access token.
            setLocalAccessToken(newToken)
        } else spinner.succeed(`Local authentication token found\n`)

        // Get access token from local store.
        const token = String(getLocalAccessToken())

        spinner.text = `Authenticating...`
        spinner.start()

        // Exchange token for credential.
        const userCredentials = await signInWithCustomToken(getAuth(), token)
        setLocalAccessToken(token)
        spinner.succeed(`Authenticated as ${theme.text.bold(userCredentials.user.uid)}.`)

        console.log(
            `\n${theme.symbols.warning} You can always log out by running the ${theme.text.bold(
                `phase2cli logout`
            )} command`
        )
        process.exit(0)
    } catch (error) {
        // Delete local token.
        console.log("An error crashed the process. Deleting local token and identity.")
        console.error(error)
        deleteLocalAccessToken()
    }
}

export default authSIWE
