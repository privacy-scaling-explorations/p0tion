import { Timestamp } from "firebase-admin/firestore"
import { CeremonyState } from "firebase/types"
import admin from "firebase-admin"
import * as functions from "firebase-functions"

/**
 * Return the current server timestamp in milliseconds.
 * @returns <number>
 */
export const getCurrentServerTimestampInMillis = () => Timestamp.now().toMillis()

/**
 * Query ceremonies by state and (start/end) date value.
 * @param state <CeremonyState>
 * @param dateField <string>
 * @returns <Promise<admin.firestore.QuerySnapshot<admin.firestore.DocumentData>>>
 */
export const queryCeremoniesByStateAndDate = async (
  state: CeremonyState,
  dateField: string
): Promise<admin.firestore.QuerySnapshot<admin.firestore.DocumentData>> => {
  // Get DB.
  const firestoreDb = admin.firestore()

  if (dateField !== "startDate" && dateField !== "endDate") throw new Error(`Wrong date field!`)

  return firestoreDb
    .collection("ceremonies")
    .where("state", "==", state)
    .where(dateField, "<=", getCurrentServerTimestampInMillis())
    .get()
}

/**
 * Format the next zkey index.
 * @param progress <number> - the progression in zkey index (= contributions).
 * @returns <string>
 */
export const formatZkeyIndex = (progress: number): string => {
  // TODO: initial zkey index value could be generalized as .env variable.
  const initialZkeyIndex = "00000"

  let index = progress.toString()

  while (index.length < initialZkeyIndex.length) {
    index = `0${index}`
  }

  return index
}

/**
 * Get the document for the circuit of the ceremony with a given sequence position.
 * @param circuitsPath <string> - the collection path from ceremonies to circuits.
 * @param position <number> - the sequence position of the circuit.
 * @returns Promise<admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>>
 */
export const getCircuitDocumentByPosition = async (
  circuitsPath: string,
  position: number
): Promise<admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>> => {
  // Get DB.
  const firestore = admin.firestore()

  // Query for all docs.
  const circuitsQuerySnap = await firestore.collection(circuitsPath).get()
  const circuitDocs = circuitsQuerySnap.docs

  if (!circuitDocs) throw new Error(`Oops, seems that there are no circuits for the ceremony`)

  // Filter by position.
  const filteredCircuits = circuitDocs.filter(
    (circuit: admin.firestore.DocumentData) => circuit.data().sequencePosition === position
  )

  if (!filteredCircuits) throw new Error(`Oops, there are no circuits for the ceremony`)

  // Get the circuit (nb. there will be only one circuit w/ that position).
  const circuit = filteredCircuits.at(0)

  if (!circuit) throw new Error(`Oops, seems that circuit with ${position} does not exist`)

  functions.logger.info(`Circuit w/ UID ${circuit.id} at position ${position}`)

  return circuit
}

/**
 * Get the final contribution document for a specific circuit.
 * @param contributionsPath <string> - the collection path from circuit to contributions.
 * @returns Promise<admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>>
 */
export const getFinalContributionDocument = async (
  contributionsPath: string
): Promise<admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>> => {
  // Get DB.
  const firestore = admin.firestore()

  // Query for all contribution docs for circuit.
  const contributionsQuerySnap = await firestore.collection(contributionsPath).get()
  const contributionsDocs = contributionsQuerySnap.docs

  if (!contributionsDocs) throw new Error(`Oops, seems that there are no contributions for the circuit`)

  // Filter by index.
  const filteredContributions = contributionsDocs.filter(
    (contribution: admin.firestore.DocumentData) => contribution.data().zkeyIndex === "final"
  )

  if (!filteredContributions) throw new Error(`Oops, there is no final contribution for the ceremony`)

  // Get the contribution (nb. there will be only one final contribution).
  const finalContribution = filteredContributions.at(0)

  if (!finalContribution) throw new Error(`Oops, seems that the final contribution does not exist`)

  return finalContribution
}
