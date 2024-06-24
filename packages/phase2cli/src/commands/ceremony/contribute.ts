import { COMMAND_ERRORS, showError } from "../../lib/errors.js"
import { checkAndRetrieveJWTAuth } from "../../lib-api/auth.js"
import theme from "../../lib/theme.js"
import { CeremonyDocumentAPI, getOpenedCeremoniesAPI, getCeremonyCircuitsAPI } from "@p0tion/actions"
import { customSpinner, terminate } from "../../lib/utils.js"
import { promptForCeremonySelectionAPI } from "src/lib/prompts.js"

const contribute = async (cmd: { ceremony?: string; entropy?: string; auth?: string }) => {
    const { token, user } = checkAndRetrieveJWTAuth(cmd.auth)
    // Prepare data.
    let selectedCeremony: CeremonyDocumentAPI
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

    if (cmd.ceremony) {
        // Check if the input ceremony title match with an opened ceremony.
        const selectedCeremonyDocument = ceremoniesOpenedForContributions.filter(
            (openedCeremony: CeremonyDocumentAPI) => openedCeremony.prefix === cmd.ceremony
        )

        if (selectedCeremonyDocument.length !== 1) {
            // Notify user about error.
            console.log(`${theme.symbols.error} ${COMMAND_ERRORS.COMMAND_CONTRIBUTE_WRONG_OPTION_CEREMONY}`)

            // Show potential ceremonies
            console.log(`${theme.symbols.info} Currently, you can contribute to the following ceremonies: `)

            for (const openedCeremony of ceremoniesOpenedForContributions)
                console.log(`- ${theme.text.bold(openedCeremony.prefix)}\n`)

            terminate(user.displayName)
        } else selectedCeremony = selectedCeremonyDocument.at(0)
    } else {
        // Prompt the user to select a ceremony from the opened ones.
        selectedCeremony = await promptForCeremonySelectionAPI(
            ceremoniesOpenedForContributions,
            false,
            "Which ceremony would you like to contribute to?"
        )
    }
    // Get selected ceremony circuit(s) documents
    const circuits = await getCeremonyCircuitsAPI(selectedCeremony.id)

    const spinner = customSpinner(`Verifying your participant status...`, `clock`)
    spinner.start()
}

export default contribute
