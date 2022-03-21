import { createDeviceCode, exchangeDeviceCode } from "@octokit/oauth-methods"
import { GithubOAuthCodes } from "../../types"

/**
 * Generate the Github OAuth codes necessary for manual Device Flow authentication.
 * @param clientId <string> - the Github OAuth app client id.
 * @returns Promise<GithubOAuthCodes> - the Github OAuth Codes.
 */
export const getGithubOAuthCodes = async (clientId: string): Promise<GithubOAuthCodes> => {
  // Generate codes for OAuth Device Flow.
  const { data } = await createDeviceCode({
    clientType: "oauth-app",
    clientId,
    scopes: ["gist"]
  })

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval
  }
}

/**
 * The exchange of the device code from GitHub's OAuth Device Flow for OAuth Apps with Firebase.
 * @param clientId <string> - the Github OAuth app client id.
 * @param deviceCode <string> - the Github generated Device Code (from # Step 1).
 * @returns Promise<string> - the Firebase token.
 */
export const exchangeDeviceCodeWithFirebase = async (clientId: string, deviceCode: string): Promise<string> => {
  // Exchange codes w/ Firebase.
  const { authentication } = await exchangeDeviceCode({
    clientType: "oauth-app",
    clientId,
    code: deviceCode
  })

  return authentication.token
}
