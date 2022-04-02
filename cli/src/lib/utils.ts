import { request } from "@octokit/request"
import { FirebaseDocumentInfo } from "cli/types/index.js"
import { DocumentData, QueryDocumentSnapshot } from "firebase/firestore"
import ora, { Ora } from "ora"
import { getDocumentById, queryCollection } from "./firebase.js"

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
 * Throw an error if the user uid does not belongs to a coordinator.
 * @param userUID <string> - the unique identifier of the user document in the users collection.
 */
export const onlyCoordinator = async (userUID: string): Promise<void> => {
  const userDocument = await getDocumentById("users", userUID)

  if (!userDocument.exists())
    throw new Error(`\nOops, seems you are not registered yet! You have to run \`phase2cli login\` command first!`)

  const coordQuerySnap = await queryCollection("coordinators", "userId", "==", userUID)

  if (coordQuerySnap.empty || coordQuerySnap.size === 0)
    throw new Error(`Oops, seems you are not eligible to be a coordinator for a ceremony!`)
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
