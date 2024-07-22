import { checkAndRetrieveJWTAuth } from "src/lib-api/auth.js"
import { showError } from "src/lib/errors.js"
import { deleteJWTToken } from "src/lib/localConfigs.js"
import { askForConfirmation } from "src/lib/prompts.js"
import theme from "src/lib/theme.js"
import { customSpinner, sleep, terminate } from "src/lib/utils.js"

const logout = async () => {
    try {
        // Inform the user about deassociation in Github and re run auth
        console.log(
            `${
                theme.symbols.warning
            } The logout could sign you out from Firebase and will delete the access token saved locally on this machine. Therefore, you have to run ${theme.text.bold(
                "phase2cli auth"
            )} to authenticate again.\n${
                theme.symbols.info
            } Remember, we cannot revoke the authorization from your Github account from this CLI! You can do this manually as reported in the official Github documentation ${
                theme.emojis.pointDown
            }\n\n${theme.text.bold(
                theme.text.underlined(
                    `https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/reviewing-your-authorized-applications-oauth`
                )
            )}\n`
        )

        // Ask for confirmation.
        const { confirmation } = await askForConfirmation(
            "Are you sure you want to log out from this machine?",
            "Yes",
            "No"
        )

        if (confirmation) {
            const spinner = customSpinner(`Logging out...`, "clock")
            spinner.start()

            // Delete local token.
            deleteJWTToken()

            await sleep(3000) // ~3s.

            spinner.stop()
            console.log(`${theme.symbols.success} Logout successfully completed`)
        } else {
            const { user } = checkAndRetrieveJWTAuth()
            terminate(user.displayName)
        }
    } catch (err: any) {
        showError(`Something went wrong: ${err.toString()}`, true)
    }
}

export default logout
