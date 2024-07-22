import { Command } from "commander"
import github from "./github.js"
import logout from "../logout.js"

const setAuthCommands = (program: Command) => {
    const auth = program.command("authAPI").description("manage authentication")

    auth.command("github").description("authenticate with Github").action(github)
    auth.command("logout").description("logout from the current session").action(logout)

    return auth
}

export default setAuthCommands
