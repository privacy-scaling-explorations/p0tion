import { AuthResponse } from "../types/index.js"
import { showError } from "../lib/errors.js"

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

export default getGithubUser
