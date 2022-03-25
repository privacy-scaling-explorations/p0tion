#!/usr/bin/env node

import clear from "clear"
import figlet from "figlet"
import dotenv from "dotenv"
import { serverTimestamp } from "firebase/firestore"
import ora from "ora"
import theme from "../lib/theme.js"
import { getStoredOAuthToken, signIn } from "../lib/auth.js"
import { initServices, setDocument } from "../lib/firebase.js"
import { getGithubUsername, onlyCoordinator } from "../lib/utils.js"
import { askCeremonyInputData, askForConfirmation } from "../lib/prompts.js"
import { CeremonyState } from "../../types/index.js"

dotenv.config()

// Customizable spinner.
const spinner = ora({
  text: "Ceremony saving in progress...",
  spinner: "clock"
})

/**
 * Return the Github OAuth 2.0 token stored locally.
 * @returns <Promise<string>> - the Github OAuth 2.0 token.
 */
const getOAuthToken = async (): Promise<string> => {
  // Check if stored locally.
  const ghToken = getStoredOAuthToken()

  if (!ghToken)
    throw new Error(
      "\n You're not authenticated with your Github account. Please, run the `phase2cli login` command first!"
    )

  return ghToken
}

/**
 * Ceremony preparation command.
 */
async function prepare() {
  clear()

  console.log(theme.yellowD(figlet.textSync("MPC Phase2 Suite", { font: "ANSI Shadow", horizontalLayout: "full" })))

  /** CORE */
  try {
    // Initialize services.
    await initServices()

    // Get/Set OAuth Token.
    const ghToken = await getOAuthToken()

    // Sign in.
    const { user } = await signIn(ghToken)

    // Get user Github username.
    const ghUsername = await getGithubUsername(ghToken)

    console.log(theme.monoD(`Greetings, @${theme.bold(ghUsername)}!\n`))

    // Check coordinator role.
    await onlyCoordinator(user.uid)

    // Ask for input data.
    const ceremonyInputData = await askCeremonyInputData()

    // Show summary.
    console.log(`\n°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°`)
    console.log(theme.yellowD(theme.bold(`\nYour ceremony summary`)))

    console.log(
      theme.monoD(theme.bold(`\n${ceremonyInputData.title}`)),
      theme.monoD(theme.italic(`\n${ceremonyInputData.description}`)),
      theme.monoD(
        `\n\nfrom ${theme.bold(ceremonyInputData.startDate.toUTCString())} to ${theme.bold(
          ceremonyInputData.endDate.toUTCString()
        )}`
      )
    )

    for (const circuit of ceremonyInputData.circuits) {
      console.log(theme.monoD(theme.bold(`\n- Circuit # ${theme.yellowD(`${circuit.sequencePosition}`)}`)))
      console.log(
        theme.monoD(`\n${theme.bold(circuit.name)} (${theme.italic(circuit.prefix)})`),
        theme.monoD(theme.italic(`\n${circuit.description}`)),
        theme.monoD(`\n\n2^${theme.bold(circuit.powers)} PoT / ${theme.bold(circuit.constraints)} constraints`)
      )
    }
    console.log(`\n°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°\n`)

    // Ask for confirmation.
    const { confirmation } = await askForConfirmation("Can you confirm all the ceremony information?", "Sure!", "No")

    if (confirmation) {
      // Store on Firestore db.
      spinner.start()

      const ceremonyRef = await setDocument("ceremonies", {
        state: CeremonyState.SCHEDULED,
        title: ceremonyInputData.title,
        description: ceremonyInputData.description,
        startDate: ceremonyInputData.startDate,
        endDate: ceremonyInputData.endDate,
        coordinator: user.uid,
        lastUpdate: serverTimestamp()
      })

      for (const circuit of ceremonyInputData.circuits) {
        await setDocument(`ceremonies/${ceremonyRef.id}/circuits`, circuit)
      }

      spinner.stop()
      console.log(`${theme.success} Done!`)
    }
    // TODO: otherwise, the coordinator should be able to modify and change the info interactivelly!

    console.log(`\nFarewell, @${theme.bold(ghUsername)}`)
    process.exit(0)
  } catch (err: any) {
    if (err) {
      const error = err.toString()
      console.error(`\n${theme.error} Oops, something went wrong: \n${error}`)

      process.exit(1)
    }
  }
}

export default prepare
