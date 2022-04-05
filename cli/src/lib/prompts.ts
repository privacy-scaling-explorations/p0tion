import prompts, { Answers, Choice, PromptObject } from "prompts"
import { CeremonyInputData, CircuitInputData, FirebaseDocumentInfo } from "../../types/index.js"
import { getDirFilesSubPaths } from "./files.js"
import theme from "./theme.js"
import { extractPtauNumber } from "./utils.js"

/**
 * Show a binary question with custom options for confirmation purposes.
 * @param question <string> - the question to be answered.
 * @param active <string> - the active option (= yes).
 * @param inactive <string> - the inactive option (= no).
 * @returns <Promise<Answers<string>>>
 */
export const askForConfirmation = async (
  question: string,
  active: string,
  inactive: string
): Promise<Answers<string>> =>
  prompts({
    type: "toggle",
    name: "confirmation",
    message: theme.monoD(question),
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
      message: theme.monoD(`Give the ceremony a title`),
      validate: (title: string) => title.length > 0 || theme.redD(`${theme.error} You must provide a valid title/name!`)
    },
    {
      type: "text",
      name: "description",
      message: theme.monoD(`Give the ceremony a description`),
      validate: (title: string) =>
        title.length > 0 || theme.redD(`${theme.error} You must provide a valid description!`)
    },
    {
      type: "date",
      name: "startDate",
      message: theme.monoD(`When should the ceremony begin?`),
      validate: (d: any) =>
        d > Date.now() ? true : theme.redD(`${theme.error} You cannot start a ceremony in the past!`)
    }
  ]

  const { title, description, startDate } = await prompts(noEndDateCeremonyQuestions)

  if (!title || !description || !startDate) throw new Error(`Please, enter any information you are asked for.`)

  const { endDate } = await prompts({
    type: "date",
    name: "endDate",
    message: theme.monoD(`And when close?`),
    validate: (d) =>
      d > Date.now()
        ? true && d > startDate
        : theme.redD(`${theme.error} You cannot close a ceremony before the opening!`)
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
      message: theme.monoD(`Give the circuit a name`),
      validate: (value) => (value.length ? true : theme.redD(`${theme.error} You must provide a valid name!`))
    },
    {
      name: "description",
      type: "text",
      message: theme.monoD(`Give the circuit a description`),
      validate: (value) => (value.length ? true : theme.redD(`${theme.error} You must provide a valid description`))
    },
    {
      name: "avgContributionTime",
      type: "number",
      message: theme.monoD(`Est. time x contribution (seconds):`),
      validate: (value) =>
        value >= 1 && value <= 604800
          ? true
          : theme.redD(`${theme.error} You must provide a valid number for contribution time estimation (max 7 days)!`)
    }
  ]

  // Prompt for circuit data.
  const { name, description, avgContributionTime } = await prompts(circuitQuestions)

  if (!name || !description || !avgContributionTime) throw new Error(`Please, enter any information you are asked for.`)

  return {
    name,
    description,
    avgContributionTime
  }
}

/**
 * Prompt the list of running ceremonies for selection.
 * @param runningCeremoniesDocs <Array<FirebaseDocumentInfo>> - The uid and data of running cerimonies documents.
 * @returns Promise<FirebaseDocumentInfo>
 */
export const askForCeremonySelection = async (
  runningCeremoniesDocs: Array<FirebaseDocumentInfo>
): Promise<FirebaseDocumentInfo> => {
  // Create choices based on running ceremonies.
  const choices: Array<Choice> = []

  for (const ceremonyDoc of runningCeremoniesDocs) {
    const date1 = new Date(ceremonyDoc.data.endDate.toDate())
    const date2 = new Date(ceremonyDoc.data.startDate.toDate())
    const daysLeft = Math.ceil(Math.abs(date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24))

    choices.push({
      title: ceremonyDoc.data.title,
      description: `${ceremonyDoc.data.description} (${theme.yellowD(daysLeft)} days left)`,
      value: ceremonyDoc
    })
  }

  // Ask for selection.
  const { ceremony } = await prompts({
    type: "select",
    name: "ceremony",
    message: theme.monoD("Select a ceremony"),
    choices,
    initial: 0
  })

  if (!ceremony) throw new Error("Please, select a valid running ceremony!")

  return ceremony
}

/**
 * Prompt the list of local PTAU files for selection.
 * @param ptauLocalDirPath <string>
 * @returns Promise<string>
 */
export const askForPtauSelection = async (ptauLocalDirPath: string, powers: number): Promise<string> => {
  // Create choices based on local PTAU files.
  const choices: Array<Choice> = []

  const files = await getDirFilesSubPaths(ptauLocalDirPath)

  for (const file of files) {
    choices.push({
      title: file.name,
      disabled: extractPtauNumber(file.name) < powers,
      value: file.name
    })
  }

  // Ask for PTAU selection.
  const { ptauFileName } = await prompts({
    type: "select",
    name: "ptauFileName",
    message: theme.monoD("Choose from local .ptau files"),
    choices,
    initial: 0
  })

  if (!ptauFileName) throw new Error("Please, select a valid ptau!")

  return ptauFileName
}

/**
 * Prompt for entropy.
 * @returns <Promise<string>>
 */
export const askForEntropy = async (): Promise<string> => {
  const { entropy } = await prompts({
    type: "text",
    name: "entropy",
    message: theme.monoD(`Provide some entropy`),
    validate: (title: string) =>
      title.length > 0 || theme.redD(`${theme.error} You must provide a valid value for the entropy!`)
  })

  if (!entropy) throw new Error("Please, provide the entropy!")

  return entropy
}
