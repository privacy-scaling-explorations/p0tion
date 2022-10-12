import { Dirent } from "fs"
import prompts, { Answers, Choice, PromptObject } from "prompts"
import { CeremonyInputData, CircuitInputData, FirebaseDocumentInfo } from "../../types/index.js"
import { symbols, theme } from "./constants.js"
import { GENERIC_ERRORS, showError } from "./errors.js"
import { extractPoTFromFilename, extractPrefix, getCreatedCeremoniesPrefixes } from "./utils.js"

/**
 * Show a binary question with custom options for confirmation purposes.
 * @param question <string> - the question to be answered.
 * @param active <string> - the active option (= yes).
 * @param inactive <string> - the inactive option (= no).
 * @returns <Promise<Answers<string>>>
 */
export const askForConfirmation = async (question: string, active = "yes", inactive = "no"): Promise<Answers<string>> =>
  prompts({
    type: "toggle",
    name: "confirmation",
    message: theme.bold(question),
    initial: false,
    active,
    inactive
  })

/**
 * Show a series of questions about the ceremony.
 * @returns <Promise<CeremonyInputData>> - the necessary information for the ceremony entered by the coordinator.
 */
export const askCeremonyInputData = async (): Promise<CeremonyInputData> => {
  // Get ceremonies prefixes to check for duplicates.
  const ceremoniesPrefixes = await getCreatedCeremoniesPrefixes()

  const noEndDateCeremonyQuestions: Array<PromptObject> = [
    {
      type: "text",
      name: "title",
      message: theme.bold(`Give a title to your ceremony`),
      validate: (title: string) => {
        if (title.length <= 0) return theme.red(`${symbols.error} You must provide a valid title for your ceremony!`)

        if (ceremoniesPrefixes.includes(extractPrefix(title)))
          return theme.red(`${symbols.error} The title is already in use for another ceremony!`)

        return true
      }
    },
    {
      type: "text",
      name: "description",
      message: theme.bold(`Add a description`),
      validate: (title: string) =>
        title.length > 0 || theme.red(`${symbols.error} You must provide a valid description!`)
    },
    {
      type: "date",
      name: "startDate",
      message: theme.bold(`When should the ceremony open?`),
      validate: (d: any) =>
        new Date(d).valueOf() > Date.now()
          ? true
          : theme.red(`${symbols.error} You cannot start a ceremony in the past!`)
    }
  ]

  const { title, description, startDate } = await prompts(noEndDateCeremonyQuestions)

  if (!title || !description || !startDate) showError(GENERIC_ERRORS.GENERIC_DATA_INPUT, true)

  const { endDate } = await prompts({
    type: "date",
    name: "endDate",
    message: theme.bold(`And when close?`),
    validate: (d) =>
      new Date(d).valueOf() > new Date(startDate).valueOf()
        ? true
        : theme.red(`${symbols.error} You cannot close a ceremony before the opening!`)
  })

  if (!endDate) showError(GENERIC_ERRORS.GENERIC_DATA_INPUT, true)

  return {
    title,
    description,
    startDate,
    endDate
  }
}

/**
 * Show a series of questions about the circuits.
 * @returns Promise<Array<Circuit>> - the necessary information for the circuits entered by the coordinator.
 */
export const askCircuitInputData = async (): Promise<CircuitInputData> => {
  const circuitQuestions: Array<PromptObject> = [
    {
      name: "description",
      type: "text",
      message: theme.bold(`Add a description`),
      validate: (value) => (value.length ? true : theme.red(`${symbols.error} You must provide a valid description`))
    }
  ]

  // Prompt for circuit data.
  const { description } = await prompts(circuitQuestions)

  if (!description) showError(GENERIC_ERRORS.GENERIC_DATA_INPUT, true)

  return {
    description
  }
}

/**
 * Request the powers of the Powers of Tau for a specified circuit.
 * @param suggestedPowers <number> - the minimal number of powers necessary for circuit zKey generation.
 * @returns Promise<Array<Circuit>> - the necessary information for the circuits entered by the coordinator.
 */
export const askPowersOftau = async (suggestedPowers: number): Promise<any> => {
  const question: PromptObject = {
    name: "powers",
    type: "number",
    message: theme.bold(
      `Please, provide the amounts of powers you have used to generate the pre-computed zkey (>= ${suggestedPowers}):`
    ),
    validate: (value) =>
      value >= suggestedPowers
        ? true
        : theme.red(`${symbols.error} You must provide a value greater than or equal to ${suggestedPowers}`)
  }

  // Prompt for circuit data.
  const { powers } = await prompts(question)

  if (!powers) showError(GENERIC_ERRORS.GENERIC_DATA_INPUT, true)

  return {
    powers
  }
}

/**
 * Prompt the list of circuits from a specific directory.
 * @param circuitsDirents <Array<Dirent>>
 * @returns Promise<string>
 */
export const askForCircuitSelectionFromLocalDir = async (circuitsDirents: Array<Dirent>): Promise<string> => {
  const choices: Array<Choice> = []

  // Make a 'Choice' for each circuit.
  for (const circuitDirent of circuitsDirents) {
    choices.push({
      title: circuitDirent.name,
      value: circuitDirent.name
    })
  }

  // Ask for selection.
  const { circuit } = await prompts({
    type: "select",
    name: "circuit",
    message: theme.bold("Select a circuit"),
    choices,
    initial: 0
  })

  if (!circuit) showError(GENERIC_ERRORS.GENERIC_CIRCUIT_SELECTION, true)

  return circuit
}

/**
 * Prompt the list of pre-computed zkeys files from a specific directory.
 * @param zkeysDirents <Array<Dirent>>
 * @returns Promise<string>
 */
export const askForZkeySelectionFromLocalDir = async (zkeysDirents: Array<Dirent>): Promise<string> => {
  const choices: Array<Choice> = []

  // Make a 'Choice' for each zkey.
  for (const zkeyDirent of zkeysDirents) {
    choices.push({
      title: zkeyDirent.name,
      value: zkeyDirent.name
    })
  }

  // Ask for selection.
  const { zkey } = await prompts({
    type: "select",
    name: "zkey",
    message: theme.bold("Select a pre-computed zkey"),
    choices,
    initial: 0
  })

  if (!zkey) showError(GENERIC_ERRORS.GENERIC_CIRCUIT_SELECTION, true)

  return zkey
}

/**
 * Prompt the list of ptau files from a specific directory.
 * @param ptausDirents <Array<Dirent>>
 * @param suggestedPowers <number> - the minimal number of powers necessary for circuit zKey generation.
 * @returns Promise<string>
 */
export const askForPtauSelectionFromLocalDir = async (
  ptausDirents: Array<Dirent>,
  suggestedPowers: number
): Promise<string> => {
  const choices: Array<Choice> = []

  // Make a 'Choice' for each ptau.
  for (const ptauDirent of ptausDirents) {
    const powers = extractPoTFromFilename(ptauDirent.name)

    if (powers >= suggestedPowers)
      choices.push({
        title: ptauDirent.name,
        value: ptauDirent.name
      })
  }

  // Ask for selection.
  const { ptau } = await prompts({
    type: "select",
    name: "ptau",
    message: theme.bold("Select the Powers of Tau file used to generate the zKey"),
    choices,
    initial: 0,
    validate: (value) =>
      extractPoTFromFilename(value) >= suggestedPowers
        ? true
        : theme.red(
            `${symbols.error} You must select a Powers of Tau file having an equal to or greater than ${suggestedPowers} amount of powers`
          )
  })

  if (!ptau) showError(GENERIC_ERRORS.GENERIC_CIRCUIT_SELECTION, true)

  return ptau
}

/**
 * Prompt the list of opened ceremonies for selection.
 * @param openedCeremoniesDocs <Array<FirebaseDocumentInfo>> - The uid and data of opened cerimonies documents.
 * @returns Promise<FirebaseDocumentInfo>
 */
export const askForCeremonySelection = async (
  openedCeremoniesDocs: Array<FirebaseDocumentInfo>
): Promise<FirebaseDocumentInfo> => {
  const choices: Array<Choice> = []

  // Make a 'Choice' for each opened ceremony.
  for (const ceremonyDoc of openedCeremoniesDocs) {
    const now = Date.now()
    const daysLeft = Math.ceil(Math.abs(now - ceremonyDoc.data.endDate) / (1000 * 60 * 60 * 24))

    choices.push({
      title: ceremonyDoc.data.title,
      description: `${ceremonyDoc.data.description} (${theme.magenta(daysLeft)} ${
        now - ceremonyDoc.data.endDate < 0 ? `days left` : `days gone since closing`
      })`,
      value: ceremonyDoc
    })
  }

  // Ask for selection.
  const { ceremony } = await prompts({
    type: "select",
    name: "ceremony",
    message: theme.bold("Select a ceremony"),
    choices,
    initial: 0
  })

  if (!ceremony) showError(GENERIC_ERRORS.GENERIC_CEREMONY_SELECTION, true)

  return ceremony
}

/**
 * Prompt the list of circuits for a specific ceremony for selection.
 * @param circuitsDocs <Array<FirebaseDocumentInfo>> - The uid and data of ceremony circuits.
 * @returns Promise<FirebaseDocumentInfo>
 */
export const askForCircuitSelectionFromFirebase = async (
  circuitsDocs: Array<FirebaseDocumentInfo>
): Promise<FirebaseDocumentInfo> => {
  const choices: Array<Choice> = []

  // Make a 'Choice' for each circuit.
  for (const circuitDoc of circuitsDocs) {
    choices.push({
      title: `${circuitDoc.data.name}`,
      description: `(#${theme.magenta(circuitDoc.data.sequencePosition)}) ${circuitDoc.data.description}`,
      value: circuitDoc
    })
  }

  // Ask for selection.
  const { circuit } = await prompts({
    type: "select",
    name: "circuit",
    message: theme.bold("Select a circuit"),
    choices,
    initial: 0
  })

  if (!circuit) showError(GENERIC_ERRORS.GENERIC_CIRCUIT_SELECTION, true)

  return circuit
}

/**
 * Prompt for entropy or beacon.
 * @param askEntropy <boolean> - true when requesting entropy; otherwise false.
 * @returns <Promise<string>>
 */
export const askForEntropyOrBeacon = async (askEntropy: boolean): Promise<string> => {
  const { entropyOrBeacon } = await prompts({
    type: "text",
    name: "entropyOrBeacon",
    style: `${askEntropy ? `password` : `text`}`,
    message: theme.bold(`Provide ${askEntropy ? `some entropy` : `the final beacon`}`),
    validate: (title: string) =>
      title.length > 0 ||
      theme.red(`${symbols.error} You must provide a valid value for the ${askEntropy ? `entropy` : `beacon`}!`)
  })

  if (!entropyOrBeacon) showError(GENERIC_ERRORS.GENERIC_DATA_INPUT, true)

  return entropyOrBeacon
}
