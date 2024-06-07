import { Command } from "commander"
import github from "./github.js"

const setAuthCommands = (program: Command) => {
    const auth = program.command("authAPI").description("manage authentication")

    auth.command("github").description("authenticate with Github").action(github)

    return auth
}

export default setAuthCommands
