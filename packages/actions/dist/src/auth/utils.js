var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value)
          })
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value))
        } catch (e) {
          reject(e)
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value))
        } catch (e) {
          reject(e)
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected)
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next())
    })
  }
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1]
          return t[1]
        },
        trys: [],
        ops: []
      },
      f,
      y,
      t,
      g
    return (
      (g = { next: verb(0), throw: verb(1), return: verb(2) }),
      typeof Symbol === "function" &&
        (g[Symbol.iterator] = function () {
          return this
        }),
      g
    )
    function verb(n) {
      return function (v) {
        return step([n, v])
      }
    }
    function step(op) {
      if (f) throw new TypeError("Generator is already executing.")
      while (_)
        try {
          if (
            ((f = 1),
            y &&
              (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t
          if (((y = 0), t)) op = [op[0] & 2, t.value]
          switch (op[0]) {
            case 0:
            case 1:
              t = op
              break
            case 4:
              _.label++
              return { value: op[1], done: false }
            case 5:
              _.label++
              y = op[1]
              op = [0]
              continue
            case 7:
              op = _.ops.pop()
              _.trys.pop()
              continue
            default:
              if (!((t = _.trys), (t = t.length > 0 && t[t.length - 1])) && (op[0] === 6 || op[0] === 2)) {
                _ = 0
                continue
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1]
                break
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1]
                t = op
                break
              }
              if (t && _.label < t[2]) {
                _.label = t[2]
                _.ops.push(op)
                break
              }
              if (t[2]) _.ops.pop()
              _.trys.pop()
              continue
          }
          op = body.call(thisArg, _)
        } catch (e) {
          op = [6, e]
          y = 0
        } finally {
          f = t = 0
        }
      if (op[0] & 5) throw op[1]
      return { value: op[0] ? op[1] : void 0, done: true }
    }
  }
import { hasStoredOAuthToken, getStoredOAuthToken, setStoredOAuthToken } from "../libs/localStorage.js"
import { getAuth, GithubAuthProvider, signInWithCredential } from "firebase/auth"
import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device"
import { request } from "@octokit/request"
import open from "open"
import clipboard from "clipboardy"
// import { GITHUB_ERRORS, showError } from "../lib/errors.js"
/**
 * Exchange the Github OAuth 2.0 token for a Firebase credential.
 * @param token <string> - the Github OAuth 2.0 token to be exchanged.
 * @returns <OAuthCredential> - the Firebase OAuth credential object.
 */
export var exchangeTokenForCredentials = function (token) {
  return GithubAuthProvider.credential(token)
}
/**
 * Sign in w/ OAuth 2.0 token.
 * @param token <string> - the Github OAuth 2.0 token to be exchanged.
 */
export var signIn = function (token) {
  return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          // Sign in with the credential.
          return [4 /*yield*/, signInWithCredential(getAuth(), exchangeTokenForCredentials(token))]
        case 1:
          // Sign in with the credential.
          _a.sent()
          return [2 /*return*/]
      }
    })
  })
}
/**
 * Make a new countdown and throws an error when time is up.
 * @param durationInSeconds <number> - the amount of time to be counted in seconds.
 * @param intervalInSeconds <number> - update interval in seconds.
 */
export var createExpirationCountdown = function (durationInSeconds, intervalInSeconds) {
  var seconds = durationInSeconds <= 60 ? durationInSeconds : 60
  setInterval(function () {
    try {
      if (durationInSeconds !== 0) {
        // Update times.
        durationInSeconds -= intervalInSeconds
        seconds -= intervalInSeconds
        if (seconds % 60 === 0) seconds = 0
        process.stdout.write("Expires in 00:".concat(Math.floor(durationInSeconds / 60), ":").concat(seconds, "\r"))
      } else console.log("Expired")
    } catch (err) {
      // Workaround to the \r.
      process.stdout.write("\n\n")
      console.log("Expired")
    }
  }, intervalInSeconds * 1000)
}
/**
 * Manage the data requested for Github OAuth2.0.
 * @param data <GithubOAuthRequest> - the data from Github OAuth2.0 device flow request.
 */
export var onVerification = function (data) {
  return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          // Automatically open the page (# Step 2).
          return [
            4 /*yield*/,
            open(data.verification_uri)
            // Copy code to clipboard.
          ]
        case 1:
          // Automatically open the page (# Step 2).
          _a.sent()
          // Copy code to clipboard.
          clipboard.writeSync(data.user_code)
          clipboard.readSync()
          // Display data.
          console.log(
            "Visit "
              .concat(data.verification_uri, " on this device to authenticate\nYour auth code: ")
              .concat(data.user_code)
          )
          // Countdown for time expiration.
          createExpirationCountdown(data.expires_in, 1)
          return [2 /*return*/]
      }
    })
  })
}
/**
 * Return the Github OAuth 2.0 token using manual Device Flow authentication process.
 * @param clientId <string> - the client id for the CLI OAuth app.
 * @returns <string> the Github OAuth 2.0 token.
 */
export var getOAuthToken = function (clientId) {
  return __awaiter(void 0, void 0, void 0, function () {
    var clientType, tokenType, auth, token
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          clientType = "oauth-app"
          tokenType = "oauth"
          auth = createOAuthDeviceAuth({
            clientType: clientType,
            clientId: clientId,
            scopes: ["gist"],
            onVerification: onVerification
          })
          return [
            4 /*yield*/,
            auth({
              type: tokenType
            })
          ]
        case 1:
          token = _a.sent().token
          return [2 /*return*/, token]
      }
    })
  })
}
/**
 * Look for the Github 2.0 OAuth token in the local storage if present; otherwise manage the request for a new token.
 * @returns <Promise<string>>
 */
export var handleGithubToken = function (ghClientId) {
  return __awaiter(void 0, void 0, void 0, function () {
    var token
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          if (!hasStoredOAuthToken()) return [3 /*break*/, 1]
          // Get stored token.
          token = String(getStoredOAuthToken())
          return [3 /*break*/, 3]
        case 1:
          return [
            4 /*yield*/,
            getOAuthToken(ghClientId)
            // Store the new token.
          ]
        case 2:
          // if (!github.GITHUB_CLIENT_ID) showError(GITHUB_ERRORS.GITHUB_NOT_CONFIGURED_PROPERLY, true)
          // Request a new token.
          token = _a.sent()
          // Store the new token.
          setStoredOAuthToken(token)
          _a.label = 3
        case 3:
          return [2 /*return*/, token]
      }
    })
  })
}
/**
 * Get the Github username for the logged in user.
 * @param token <string> - the Github OAuth 2.0 token.
 * @returns <Promise<string>> - the user Github username.
 */
export var getGithubUsername = function (token) {
  return __awaiter(void 0, void 0, void 0, function () {
    var response
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          return [
            4 /*yield*/,
            request("GET https://api.github.com/user", {
              headers: {
                authorization: "token ".concat(token)
              }
            })
          ]
        case 1:
          response = _a.sent()
          if (response) return [2 /*return*/, response.data.login]
          console.log("error")
          return [2 /*return*/, process.exit(0)] // nb. workaround to avoid type issues.
      }
    })
  })
}
//# sourceMappingURL=utils.js.map
