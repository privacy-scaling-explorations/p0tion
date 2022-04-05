import { request } from "@octokit/request"
import { FirebaseDocumentInfo } from "cli/types/index.js"
import { DocumentData, QueryDocumentSnapshot } from "firebase/firestore"
import ora, { Ora } from "ora"

/**
 * Get the Github username for the logged in user.
 * @param token <string> - the Github OAuth 2.0 token.
 * @returns <Promise<string>> - the user Github username.
 */
export const getGithubUsername = async (token: string): Promise<string> => {
  // Get user info from Github APIs.
  const response = await request("GET https://api.github.com/user", {
    headers: {
      authorization: `token ${token}`
    }
  })

  if (response) return response.data.login
  throw new Error(`There was an error retrieving your Github username. Please try again later.`)
}

/**
 * Helper for obtaining uid and data for query document snapshots.
 * @param queryDocSnap <Array<QueryDocumentSnapshot>> - the array of query document snapshot to be converted.
 * @returns Array<FirebaseDocumentInfo>
 */
export const fromQueryToFirebaseDocumentInfo = (
  queryDocSnap: Array<QueryDocumentSnapshot>
): Array<FirebaseDocumentInfo> =>
  queryDocSnap.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
    id: doc.id,
    data: doc.data()
  }))

/**
 * Return a custom spinner.
 * @param text <string> - the text that should be displayed as spinner status.
 * @param spinnerLogo <any> - the logo.
 * @returns <Ora> - a new Ora custom spinner.
 */
export const customSpinner = (text: string, spinnerLogo: any): Ora =>
  ora({
    text,
    spinner: spinnerLogo
  })

/**
 * Get a value from a key information about a circuit.
 * @param circuitInfo <string> - the stringified content of the .r1cs file.
 * @param rgx <RegExp> - regular expression to match the key.
 * @returns <string>
 */
export const getCircuitMetadataFromR1csFile = (circuitInfo: string, rgx: RegExp): string => {
  // Match.
  const matchInfo = circuitInfo.match(rgx)

  if (!matchInfo) throw new Error(`Requested information was not found in the .r1cs file!`)

  // Split and return the value.
  return matchInfo[0].split(":")[1].replace(" ", "").split("#")[0].replace("\n", "")
}

/**
 * Return the necessary Power of Tau "powers" given the number of circuits constraints.
 * @param constraints <number> - the number of circuit contraints
 * @returns <number>
 */
export const estimatePoT = (constraints: number): number => {
  let power = 1
  let pot = 2 ** power

  while (constraints > pot) {
    power += 1
    pot = 2 ** power
  }

  return power
}

export const extractPtauNumber = (ptauFileName: string): number =>
  Number(ptauFileName.split("_")[2].replace(".ptau", ""))

export const extractCeremonyPrefixFromTitle = (ceremonyTitle: string): string =>
  ceremonyTitle.replace(" ", "_").replace(".", "_").toLowerCase()

export const extractCircuitPrefixFromName = (circuitName: string): string => circuitName.replace(" ", "_").toLowerCase()
