#!/usr/bin/env node

import clear from "clear"
import figlet from "figlet"
import dotenv from "dotenv"
import { serverTimestamp } from "firebase/firestore"
import theme from "../lib/theme.js"
import { checkForStoredOAuthToken, getCurrentAuthUser, signIn } from "../lib/auth.js"
import { initServices, setDocument } from "../lib/firebase.js"
import { customSpinner, getGithubUsername, onlyCoordinator } from "../lib/utils.js"
import { askCeremonyData, askCircuitsData, askForConfirmation } from "../lib/prompts.js"
import { Ceremony, CeremonyState, Circuit } from "../../types/index.js"

dotenv.config()

// Customizable spinner.
const spinner = customSpinner("Ceremony saving in progress...", "clock")

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
    const ghToken = await checkForStoredOAuthToken()

    // Sign in.
    await signIn(ghToken)

    // Get current authenticated user.
    const user = getCurrentAuthUser()

    // Get user Github username.
    const ghUsername = await getGithubUsername(ghToken)

    console.log(theme.monoD(`Greetings, @${theme.bold(ghUsername)}!\n`))

    await onlyCoordinator(user.uid)

    // Ask for ceremony input data.
    const ceremonyInputData = await askCeremonyData()

    // Ask for circuits data.
    const circuits = await askCircuitsData()

    // Show summary.
    console.log(`\n°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°`)
    console.log(theme.yellowD(theme.bold(`\nYour ceremony summary`)))

    console.log(
      theme.monoD(theme.bold(`\n${ceremonyInputData.title}`)),
      theme.monoD(theme.italic(`\n${ceremonyInputData.description}`)),
      theme.monoD(
        `\n\nfrom ${theme.bold(ceremonyInputData.startDate.toString())} to ${theme.bold(
          ceremonyInputData.endDate.toString()
        )}`
      )
    )

    for (const circuit of circuits) {
      console.log(theme.monoD(theme.bold(`\n- Circuit # ${theme.yellowD(`${circuit.sequencePosition}`)}`)))
      console.log(
        theme.monoD(`\n${theme.bold(circuit.name)} (${theme.italic(circuit.prefix)})`),
        theme.monoD(theme.italic(`\n${circuit.description}`)),
        theme.monoD(`\n\n2^${theme.bold(circuit.powers)} PoT / ${theme.bold(circuit.constraints)} constraints`),
        theme.monoD(`\nest. contribution time ${theme.bold(circuit.avgContributionTime)} seconds`)
      )
    }
    console.log(`\n°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°\n`)

    // Ask for confirmation.
    const { confirmation } = await askForConfirmation("Can you confirm all the ceremony information?", "Sure!", "No")

    if (confirmation) {
      // Store on Firestore db.
      spinner.start()

      const ceremonyDoc: Ceremony = {
        ...ceremonyInputData,
        state: CeremonyState.SCHEDULED,
        coordinatorId: user.uid,
        lastUpdate: serverTimestamp()
      }

      const ceremonyRef = await setDocument("ceremonies", ceremonyDoc)

      for (const circuit of circuits) {
        const circuitDoc: Circuit = {
          ...circuit,
          lastUpdate: serverTimestamp()
        }

        await setDocument(`ceremonies/${ceremonyRef.id}/circuits`, circuitDoc)
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
