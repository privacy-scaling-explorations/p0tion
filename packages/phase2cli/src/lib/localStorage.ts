import Conf from "conf"
import { readLocalJsonFile } from "./utils"

// Get npm package name.
const { name } = readLocalJsonFile("../../package.json")

/**
 * Create a new instance of the local storage.
 * @dev The CLI implementation use the Conf package to create a local storage
 * in the user device (`.config/@zkmpc/phase2cli-nodejs/config.json` path) to store the access token.
 */
const config = new Conf({
    projectName: name,
    schema: {
        accessToken: {
            type: "string",
            default: ""
        }
    }
})

/**
 * Return the access token, if present.
 * @returns <string | undefined> - the access token if present, otherwise undefined.
 */
export const getLocalAccessToken = (): string | unknown => config.get("accessToken")

/**
 * Check if the access token exists in the local storage.
 * @returns <boolean>
 */
export const checkLocalAccessToken = (): boolean => config.has("accessToken") && !!config.get("accessToken")

/**
 * Set the access token.
 * @param token <string> - the access token to be stored.
 */
export const setLocalAccessToken = (token: string) => config.set("accessToken", token)

/**
 * Delete the stored access token.
 */
export const deleteLocalAccessToken = () => config.delete("accessToken")
