import { FirebaseDocumentInfo } from "cli/types"
import { DocumentSnapshot, onSnapshot } from "firebase/firestore"
import theme from "./theme.js"
import { convertMillisToSeconds } from "./utils.js"

/**
 * Return the index of a given participant in a circuit waiting queue.
 * @param contributors <Array<string>> - the list of the contributors in queue for a circuit.
 * @param participantId <string> - the unique identifier of the participant.
 * @returns <number>
 */
const getParticipantPositionInQueue = (contributors: Array<string>, participantId: string): number =>
  contributors.indexOf(participantId) + 1

export default (participantId: string, circuit: FirebaseDocumentInfo) => {
  const unsubscriberForCircuitDocument = onSnapshot(circuit.ref, async (circuitDocSnap: DocumentSnapshot) => {
    // Get updated data from snap.
    const newCircuitData = circuitDocSnap.data()

    if (!newCircuitData) throw new Error(`Something went wrong while retrieving your data`)

    const { avgContributionTime, waitingQueue } = newCircuitData

    const newParticipantPositionInQueue = getParticipantPositionInQueue(waitingQueue.contributors, participantId)
    const newEstimatedWaitingTime = convertMillisToSeconds(avgContributionTime) * (newParticipantPositionInQueue - 1)
    const newEstimatedContributionTime =
      newEstimatedWaitingTime < 60 ? newEstimatedWaitingTime : Math.floor(newEstimatedWaitingTime / 60)

    switch (newParticipantPositionInQueue) {
      case 1:
        console.log(theme.monoD(`${theme.success} Your turn has finally come!`))
        unsubscriberForCircuitDocument()
        break
      case 2:
        console.log(
          theme.monoD(
            `\n${theme.info} You are the next in the queue! (est. ~${theme.bold(
              theme.yellowD(newEstimatedContributionTime)
            )}${newEstimatedContributionTime < 60 ? `s` : `m`})`
          )
        )
        console.log(
          `${theme.warning} ${theme.bold(theme.yellowD(waitingQueue.currentContributor))} is currently contributing!`
        )
        break
      default:
        console.log(
          theme.monoD(
            `\n${theme.info} Your position in queue is ${theme.bold(
              theme.yellowD(newParticipantPositionInQueue)
            )} now (est. ~${theme.bold(
              theme.yellowD(newParticipantPositionInQueue === 1 ? 0 : newEstimatedContributionTime)
            )}${newEstimatedContributionTime < 60 ? `s` : `m`})`
          )
        )
        console.log(
          `${theme.warning} ${theme.bold(theme.yellowD(waitingQueue.currentContributor))} is currently contributing!`
        )
        break
    }
  })
}
