import { request } from "@octokit/request"
import { isUserCoordinator } from "./firebase.js"

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
  if (!(await isUserCoordinator(userUID)))
    throw new Error(`Oops, seems you are not eligible to be a coordinator for a ceremony!`)
}
