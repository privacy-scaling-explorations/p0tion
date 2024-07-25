import { checkAndRetrieveJWTAuth } from "src/lib-api/auth.js"

const finalize = async (cmd: { auth?: string }) => {
    const { token, user } = checkAndRetrieveJWTAuth(cmd.auth)
}

export default finalize
