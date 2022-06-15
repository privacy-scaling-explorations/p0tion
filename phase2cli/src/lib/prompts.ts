import prompts, { Answers, Choice, PromptObject } from "prompts"
import { CeremonyInputData, CircuitInputData, FirebaseDocumentInfo } from "../../types/index.js"
import { symbols, theme } from "./constants.js"

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
  const noEndDateCeremonyQuestions: Array<PromptObject> = [
    {
      type: "text",
      name: "title",
      message: theme.bold(`Give the ceremony a title`),
      validate: (title: string) =>
        title.length > 0 || theme.red(`${symbols.error} You must provide a valid title/name!`)
    },
    {
      type: "text",
      name: "description",
      message: theme.bold(`Give the ceremony a description`),
      validate: (title: string) =>
        title.length > 0 || theme.red(`${symbols.error} You must provide a valid description!`)
    },
    {
      type: "date",
      name: "startDate",
      message: theme.bold(`When should the ceremony begin?`),
      validate: (d: any) =>
        d > Date.now() ? true : theme.red(`${symbols.error} You cannot start a ceremony in the past!`)
    }
  ]

  const { title, description, startDate } = await prompts(noEndDateCeremonyQuestions)

  if (!title || !description || !startDate) throw new Error(`Please, enter any information you are asked for.`)

  const { endDate } = await prompts({
    type: "date",
    name: "endDate",
    message: theme.bold(`And when close?`),
    validate: (d) =>
      d > Date.now()
        ? true && d > startDate
        : theme.red(`${symbols.error} You cannot close a ceremony before the opening!`)
  })

  if (!endDate) throw new Error(`Please, enter any information you are asked for.`)

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
      name: "name",
      type: "text",
      message: theme.bold(`Give the circuit a name`),
      validate: (value) => (value.length ? true : theme.red(`${symbols.error} You must provide a valid name!`))
    },
    {
      name: "description",
      type: "text",
      message: theme.bold(`Give the circuit a description`),
      validate: (value) => (value.length ? true : theme.red(`${symbols.error} You must provide a valid description`))
    }
  ]

  // Prompt for circuit data.
  const { name, description } = await prompts(circuitQuestions)

  if (!name || !description) throw new Error(`Please, enter any information you are asked for.`)

  return {
    name,
    description
  }
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
    const daysLeft = Math.ceil(Math.abs(ceremonyDoc.data.startDate - ceremonyDoc.data.endDate) / (1000 * 60 * 60 * 24))

    choices.push({
      title: ceremonyDoc.data.title,
      description: `${ceremonyDoc.data.description} (${theme.yellow(daysLeft)} days left)`,
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

  if (!ceremony) throw new Error("Please, select a valid opened ceremony!")

  return ceremony
}

/**
 * Prompt the list of circuits for a specific ceremony for selection.
 * @param circuitsDocs <Array<FirebaseDocumentInfo>> - The uid and data of ceremony circuits.
 * @returns Promise<FirebaseDocumentInfo>
 */
export const askForCircuitSelection = async (
  circuitsDocs: Array<FirebaseDocumentInfo>
): Promise<FirebaseDocumentInfo> => {
  const choices: Array<Choice> = []

  // Make a 'Choice' for each circuit.
  for (const circuitDoc of circuitsDocs) {
    choices.push({
      title: `${circuitDoc.data.name}`,
      description: `(#${theme.yellow(circuitDoc.data.sequencePosition)}) ${circuitDoc.data.description}`,
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

  if (!circuit) throw new Error("Please, select a valid circuit!")

  return circuit
}

/**
 * Prompt for entropy.
 * @returns <Promise<string>>
 */
export const askForEntropy = async (): Promise<string> => {
  const { entropy } = await prompts({
    type: "text",
    name: "entropy",
    message: theme.bold(`Provide some entropy`),
    validate: (title: string) =>
      title.length > 0 || theme.red(`${symbols.error} You must provide a valid value for the entropy!`)
  })

  if (!entropy) throw new Error("Please, provide the entropy!")

  return entropy
}
