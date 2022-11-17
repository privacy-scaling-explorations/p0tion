import Conf from "conf"
// Local configstore for storing auth data (e.g., tokens).
var config = new Conf({
  projectName: "dummy",
  schema: {
    authToken: {
      type: "string",
      default: ""
    }
  }
})
/**
 * Check if the Github OAuth 2.0 token exists in the local config store.
 * @returns <boolean>
 */
export var hasStoredOAuthToken = function () {
  return config.has("authToken") && !!config.get("authToken")
}
/**
 * Return the Github OAuth 2.0 token, if present.
 * @returns <string | undefined> - the Github OAuth 2.0 token if present, otherwise undefined.
 */
export var getStoredOAuthToken = function () {
  return config.get("authToken")
}
/**
 * Store the Github OAuth 2.0 token.
 * @param token <string> - the Github OAuth 2.0 token to be stored.
 */
export var setStoredOAuthToken = function (token) {
  return config.set("authToken", token)
}
//# sourceMappingURL=localStorage.js.map
