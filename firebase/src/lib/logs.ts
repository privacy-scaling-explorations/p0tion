import * as functions from "firebase-functions"

export const GENERIC_ERRORS = {
  GENERR_MISSING_INPUT: `You have not provided all the necessary data`,
  GENERR_NO_AUTH_USER_FOUND: `The given id does not belong to an authenticated user`,
  GENERR_NO_COORDINATOR: `The given id does not belong to a coordinator`,
  GENERR_NO_CEREMONY_PROVIDED: `No ceremony has been provided`,
  GENERR_NO_CIRCUIT_PROVIDED: `No circuit has been provided`,
  GENERR_NO_CEREMONIES_OPENED: `No ceremonies are opened to contributions`,
  GENERR_INVALID_CEREMONY: `The given ceremony is invalid`,
  GENERR_INVALID_CIRCUIT: `The given circuit is invalid`,
  GENERR_INVALID_PARTICIPANT: `The given participant is invalid`,
  GENERR_CEREMONY_NOT_OPENED: `The given ceremony is not opened to contributions`,
  GENERR_CEREMONY_NOT_CLOSED: `The given ceremony is not closed for finalization`,
  GENERR_INVALID_PARTICIPANT_STATUS: `The participant has an invalid status`,
  GENERR_INVALID_CONTRIBUTION_PROGRESS: `The contribution progress is invalid`,
  GENERR_INVALID_DOCUMENTS: `One or more provided identifier does not belong to a document`,
  GENERR_NO_DATA: `Data not found`,
  GENERR_NO_CIRCUIT: `Circuits not found`,
  GENERR_NO_PARTICIPANT: `Participant not found`,
  GENERR_NO_CONTRIBUTION: `Contributions not found`,
  GENERR_NO_CIRCUITS: `Circuits not found for the ceremony`,
  GENERR_NO_CONTRIBUTIONS: `Contributions not found for the circuit`,
  GENERR_NO_RETRY: `The retry waiting time has not passed away yet`,
  GENERR_WRONG_PATHS: `Wrong storage or database paths`,
  GENERR_WRONG_FIELD: `Wrong document field`,
  GENERR_WRONG_ENV_CONFIGURATION: `Your environment variables are not configured properly`
}

export const GENERIC_LOGS = {
  GENLOG_NO_CEREMONIES_READY_TO_BE_OPENED: `There are no cerimonies ready to be opened to contributions`,
  GENLOG_NO_CEREMONIES_READY_TO_BE_CLOSED: `There are no cerimonies ready to be closed`,
  GENLOG_NO_CURRENT_CONTRIBUTOR: `There is no current contributor for the circuit`,
  GENLOG_NO_TIMEOUT: `The timeout must not be triggered yet`
}

/**
 * Print an error or log string and can gracefully terminate the process.
 * @param err <string> - the error or log string to be shown.
 * @param doExit <boolean> - when true the function terminate the process; otherwise not.
 */
export const showErrorOrLog = (err: string, doExit: boolean) => {
  // Print the error
  if (!doExit) functions.logger.info(err)
  else functions.logger.error(err)

  // Terminate the process.
  if (doExit) process.exit(0)
}
