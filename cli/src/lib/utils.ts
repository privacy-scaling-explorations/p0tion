import { request } from "@octokit/request"
import { FirebaseDocumentInfo } from "cli/types/index.js"
import { DocumentData, QueryDocumentSnapshot, Timestamp } from "firebase/firestore"
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
 * Publish a new attestation through a Github Gist.
 * @param token <string> - the Github OAuth 2.0 token.
 * @param content <string> - the content of the attestation.
 * @param ceremonyPrefix <string> - the ceremony prefix.
 * @param ceremonyTitle <string> - the ceremony title.
 */
export const publishGist = async (
  token: string,
  content: string,
  ceremonyPrefix: string,
  ceremonyTitle: string
): Promise<string> => {
  const response = await request("POST /gists", {
    description: `Attestation for ${ceremonyTitle} MPC Phase 2 Trusted Setup ceremony`,
    public: true,
    files: {
      [`${ceremonyPrefix}_attestation.txt`]: {
        content
      }
    },
    headers: {
      authorization: `token ${token}`
    }
  })

  if (response && response.data.html_url) return response.data.html_url
  throw new Error(`There were errors when publishing a Gist from your Github account.`)
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
    ref: doc.ref,
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

/**
 * Get the powers from ptau file name
 * @dev the ptau files must follow these convention (i_am_a_ptau_file_09.ptau) where the numbers before '.ptau' are the powers.
 * @param ptauFileName <string>
 * @returns <number>
 */
export const extractPtauPowers = (ptauFileName: string): number =>
  Number(ptauFileName.split("_").pop()?.split(".").at(0))

/**
 * Extract a prefix (like_this) from a provided string with special characters and spaces.
 * @dev replaces all symbols and whitespaces with underscore.
 * @param str <string>
 * @returns <string>
 */
export const extractPrefix = (str: string): string =>
  // eslint-disable-next-line no-useless-escape
  str.replace(/[`\s~!@#$%^&*()|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, "_").toLowerCase()

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
 * Convert milliseconds to seconds.
 * @param millis <number>
 * @returns <number>
 */
export const convertMillisToSeconds = (millis: number): number => Number((millis / 1000).toFixed(2))

/**
 * Return the current server timestamp in milliseconds.
 * @returns <number>
 */
export const getServerTimestampInMillis = (): number => Timestamp.now().toMillis()
