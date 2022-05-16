#!/usr/bin/env node

import clear from "clear"
import figlet from "figlet"
import { DocumentSnapshot, onSnapshot } from "firebase/firestore"
import theme from "../lib/theme.js"
import { checkForStoredOAuthToken, signIn, getCurrentAuthUser, onlyCoordinator } from "../lib/auth.js"
import { initServices } from "../lib/firebase.js"
import { convertMillisToSeconds, getGithubUsername } from "../lib/utils.js"
import { askForCeremonySelection, askForCircuitSelection } from "../lib/prompts.js"
import { getCeremonyCircuits, getCurrentContributorContribution, getOpenedCeremonies } from "../lib/queries.js"

/**
 * Observe command.
 */
async function observe() {
  clear()

  console.log(theme.yellowD(figlet.textSync("MPC Phase2 Suite", { font: "ANSI Shadow", horizontalLayout: "full" })))

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

    console.log(theme.monoD(`Greetings, @${theme.monoD(theme.bold(ghUsername))}!\n`))

    // Check custom claims for coordinator role.
    await onlyCoordinator(user)

    // Get running cerimonies info (if any).
    const runningCeremoniesDocs = await getOpenedCeremonies()

    // Ask to select a ceremony.
    const ceremony = await askForCeremonySelection(runningCeremoniesDocs)

    // Get ceremony circuits.
    const circuits = await getCeremonyCircuits(ceremony.id)

    // Ask to select a specific circuit.
    const circuit = await askForCircuitSelection(circuits)

    console.log(theme.monoD(theme.bold(`\n- Circuit # ${theme.yellowD(`${circuit.data.sequencePosition}`)}`)))

    // Observe a specific circuit.
    onSnapshot(circuit.ref, async (circuitDocSnap: DocumentSnapshot) => {
      // Get updated data from snap.
      const newCircuitData = circuitDocSnap.data()

      if (!newCircuitData) throw new Error(`Something went wrong while retrieving your data`)

      const { waitingQueue } = newCircuitData

      // Get info from circuit.
      const { currentContributor } = waitingQueue
      const { completedContributions } = waitingQueue

      if (!currentContributor) console.log(`\n> Nobody's currently waiting to contribute 👀`)
      else {
        // Search for currentContributor' contribution.
        const contributions = await getCurrentContributorContribution(ceremony.id, circuit.id, currentContributor)

        if (contributions.length === 0)
          // The contributor is currently contributing.
          console.log(
            theme.monoD(
              `> ${theme.yellowD(currentContributor)} (# ${theme.yellowD(
                completedContributions + 1
              )}) is currently contributing!`
            )
          )
        else {
          // The contributor has finished the contribution.
          const contributionData = contributions.at(0)?.data

          if (!contributionData) throw new Error(`Wrong contribution data!`)

          console.log(
            theme.monoD(
              `> Computation took ${theme.yellowD(convertMillisToSeconds(contributionData.contributionTime))} seconds`
            )
          )
          console.log(
            theme.monoD(
              `> Verification took ${theme.yellowD(convertMillisToSeconds(contributionData.verificationTime))} seconds`
            )
          )
          console.log(
            theme.monoD(
              `> Contribution # ${theme.yellowD(completedContributions)} ${
                contributionData.valid ? `okay ${theme.success}` : `invalid ${theme.error}`
              }`
            )
          )
        }
      }
    })
  } catch (err: any) {
    if (err) {
      const error = err.toString()
      console.error(`\n${theme.error} Oops, something went wrong: \n${error}`)

      process.exit(1)
    }
  }
}

export default observe
