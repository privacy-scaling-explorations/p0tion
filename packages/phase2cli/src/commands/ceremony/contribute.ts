import { COMMAND_ERRORS, showError } from "../../lib/errors.js"
import { checkAndRetrieveJWTAuth } from "../../lib-api/auth.js"
import theme from "../../lib/theme.js"
import { getOpenedCeremoniesAPI } from "@p0tion/actions"

const contribute = async (cmd: { ceremony?: string; entropy?: string; auth?: string }) => {
    const { token, user } = checkAndRetrieveJWTAuth(cmd.auth)
    // Retrieve the opened ceremonies.
    const ceremoniesOpenedForContributions = await getOpenedCeremoniesAPI()

    // Gracefully exit if no ceremonies are opened for contribution.
    if (!ceremoniesOpenedForContributions.length)
        showError(COMMAND_ERRORS.COMMAND_CONTRIBUTE_NO_OPENED_CEREMONIES, true)

    console.log(
        `${theme.symbols.warning} ${theme.text.bold(
            `The contribution process is based on a parallel waiting queue mechanism allowing one contributor at a time per circuit with a maximum time upper-bound. Each contribution may require the bulk of your computing resources and memory based on the size of the circuit (ETAs could vary!). If you stop your contribution at any step, you have to restart the step from scratch (except for uploading).`
        )}\n`
    )
}

export default contribute
