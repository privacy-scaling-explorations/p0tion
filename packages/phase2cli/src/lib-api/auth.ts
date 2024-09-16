import jwt from "jsonwebtoken"
import { checkJWTToken, deleteJWTToken, getJWTToken } from "../lib/localConfigs.js"
import { AuthResponse, User } from "../types/index.js"
import { THIRD_PARTY_SERVICES_ERRORS, showError } from "../lib/errors.js"

export const getGithubClientId = async () => {
    try {
        const result = (await fetch(`${process.env.API_URL}/auth/github/client-id`, {
            headers: { "Content-Type": "application/json" },
            method: "GET"
        }).then((res) => res.json())) as { client_id: string }
        if (!result.client_id || result.client_id === "")
            showError(THIRD_PARTY_SERVICES_ERRORS.GITHUB_CLIENT_ID_NOT_FOUND, true)
        return result.client_id
    } catch (error) {
        showError(`[${error.code}] ${error.message}`, true)
        return ""
    }
}

export const getGithubUser = async (ghToken: string) => {
    try {
        const result = (await fetch(`${process.env.API_URL}/auth/github/user`, {
            headers: { "Content-Type": "application/json" },
            method: "POST",
            body: JSON.stringify({
                access_token: ghToken,
                token_type: "bearer"
            })
        }).then((res) => res.json())) as AuthResponse
        return result
    } catch (error: any) {
        const errorBody = JSON.parse(JSON.stringify(error))
        showError(`[${errorBody.code}] ${error.message} ${!errorBody.details ? "" : `\n${errorBody.details}`}`, true)
        return { jwt: "", user: {} }
    }
}

export const checkAndRetrieveJWTAuth = (auth?: string) => {
    let decode: { user: User; exp: number; iat: number }
    let token: string
    if (auth) {
        decode = jwt.decode(auth) as { user: User; exp: number; iat: number }
    } else {
        const isJWTTokenStored = checkJWTToken()
        if (!isJWTTokenStored) showError(THIRD_PARTY_SERVICES_ERRORS.GITHUB_NOT_AUTHENTICATED, true)
        token = getJWTToken() as string
        decode = jwt.decode(token) as { user: User; exp: number; iat: number }
    }
    const { user, exp } = decode
    if (exp < Date.now() / 1000) {
        deleteJWTToken()
        showError(THIRD_PARTY_SERVICES_ERRORS.GITHUB_TOKEN_EXPIRED, true)
    }
    return { token, user }
}
