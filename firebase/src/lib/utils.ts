import { DocumentData, DocumentSnapshot, Timestamp, WhereFilterOp } from "firebase-admin/firestore"
import admin from "firebase-admin"
import * as functions from "firebase-functions"
import { CeremonyState, MsgType } from "../../types/index.js"
import { ceremoniesCollectionFields, collections, timeoutsCollectionFields } from "./constants.js"
import { GENERIC_ERRORS, logMsg } from "./logs.js"

/**
 * Return the current server timestamp in milliseconds.
 * @returns <number>
 */
export const getCurrentServerTimestampInMillis = (): number => Timestamp.now().toMillis()

/**
 * Query ceremonies by state and (start/end) date value.
 * @param state <CeremonyState> - the value of the state to be queried.
 * @param dateField <string> - the start or end date field.
 * @param check <WhereFilerOp> - the query filter (where check).
 * @returns <Promise<admin.firestore.QuerySnapshot<admin.firestore.DocumentData>>>
 */
export const queryCeremoniesByStateAndDate = async (
  state: CeremonyState,
  dateField: string,
  check: WhereFilterOp
): Promise<admin.firestore.QuerySnapshot<admin.firestore.DocumentData>> => {
  // Get DB.
  const firestoreDb = admin.firestore()

  if (dateField !== ceremoniesCollectionFields.startDate && dateField !== ceremoniesCollectionFields.endDate)
    logMsg(GENERIC_ERRORS.GENERR_WRONG_FIELD, MsgType.ERROR)

  return firestoreDb
    .collection(collections.ceremonies)
    .where(ceremoniesCollectionFields.state, "==", state)
    .where(dateField, check, getCurrentServerTimestampInMillis())
    .get()
}

/**
 * Query timeouts by (start/end) date value.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param participantId <string> - the unique identifier of the participant.
 * @param dateField <string> - the name of the date field.
 * @returns <Promise<admin.firestore.QuerySnapshot<admin.firestore.DocumentData>>>
 */
export const queryValidTimeoutsByDate = async (
  ceremonyId: string,
  participantId: string,
  dateField: string
): Promise<admin.firestore.QuerySnapshot<admin.firestore.DocumentData>> => {
  // Get DB.
  const firestoreDb = admin.firestore()

  if (dateField !== timeoutsCollectionFields.startDate && dateField !== timeoutsCollectionFields.endDate)
    logMsg(GENERIC_ERRORS.GENERR_WRONG_FIELD, MsgType.ERROR)

  return firestoreDb
    .collection(
      `${collections.ceremonies}/${ceremonyId}/${collections.participants}/${participantId}/${collections.timeouts}`
    )
    .where(dateField, ">=", getCurrentServerTimestampInMillis())
    .get()
}

/**
 * Return the document belonging to a participant with a specified id (if exist).
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param participantId <string> - the unique identifier of the participant.
 * @returns <Promise<DocumentSnapshot<DocumentData>>>
 */
export const getParticipantById = async (
  ceremonyId: string,
  participantId: string
): Promise<DocumentSnapshot<DocumentData>> => {
  // Get DB.
  const firestore = admin.firestore()

  const participantDoc = await firestore
    .collection(`${collections.ceremonies}/${ceremonyId}/${collections.participants}`)
    .doc(participantId)
    .get()

  if (!participantDoc.exists) logMsg(GENERIC_ERRORS.GENERR_NO_PARTICIPANT, MsgType.ERROR)

  return participantDoc
}

/**
 * Return all circuits for a given ceremony (if any).
 * @param circuitsPath <string> - the collection path from ceremonies to circuits.
 * @returns Promise<Array<admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>>>
 */
export const getCeremonyCircuits = async (
  circuitsPath: string
): Promise<Array<admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>>> => {
  // Get DB.
  const firestore = admin.firestore()

  // Query for all docs.
  const circuitsQuerySnap = await firestore.collection(circuitsPath).get()
  const circuitDocs = circuitsQuerySnap.docs

  if (!circuitDocs) logMsg(GENERIC_ERRORS.GENERR_NO_CIRCUITS, MsgType.ERROR)

  return circuitDocs
}

/**
 * Format the next zkey index.
 * @param progress <number> - the progression in zkey index (= contributions).
 * @returns <string>
 */
export const formatZkeyIndex = (progress: number): string => {
  if (!process.env.FIRST_ZKEY_INDEX) logMsg(GENERIC_ERRORS.GENERR_WRONG_ENV_CONFIGURATION, MsgType.ERROR)

  const initialZkeyIndex = process.env.FIRST_ZKEY_INDEX!

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
  // Query for all circuit docs.
  const circuitDocs = await getCeremonyCircuits(circuitsPath)

  // Filter by position.
  const filteredCircuits = circuitDocs.filter(
    (circuit: admin.firestore.DocumentData) => circuit.data().sequencePosition === position
  )

  if (!filteredCircuits) logMsg(GENERIC_ERRORS.GENERR_NO_CIRCUIT, MsgType.ERROR)

  // Get the circuit (nb. there will be only one circuit w/ that position).
  const circuit = filteredCircuits.at(0)

  if (!circuit) logMsg(GENERIC_ERRORS.GENERR_NO_CIRCUIT, MsgType.ERROR)

  functions.logger.info(`Circuit w/ UID ${circuit?.id} at position ${position}`)

  return circuit!
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

  if (!contributionsDocs) logMsg(GENERIC_ERRORS.GENERR_NO_CONTRIBUTIONS, MsgType.ERROR)

  // Filter by index.
  const filteredContributions = contributionsDocs.filter(
    (contribution: admin.firestore.DocumentData) => contribution.data().zkeyIndex === "final"
  )

  if (!filteredContributions) logMsg(GENERIC_ERRORS.GENERR_NO_CONTRIBUTION, MsgType.ERROR)

  // Get the contribution (nb. there will be only one final contribution).
  const finalContribution = filteredContributions.at(0)

  if (!finalContribution) logMsg(GENERIC_ERRORS.GENERR_NO_CONTRIBUTION, MsgType.ERROR)

  return finalContribution!
}
