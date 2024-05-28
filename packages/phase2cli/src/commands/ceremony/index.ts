import { Command } from "commander"
import listParticipants from "./listParticipants.js"
import create from "./create.js"

const setCeremonyCommands = (program: Command) => {
    const ceremony = program.command("ceremony").description("manage ceremonies")

    ceremony
        .command("participants")
        .description("retrieve participants list of a ceremony")
        .requiredOption(
            "-c, --ceremony <string>",
            "the prefix of the ceremony you want to retrieve information about",
            ""
        )
        .action(listParticipants)

    ceremony
        .command("create")
        .description("create a new ceremony")
        .option("-t, --template <path>", "The path to the ceremony setup template", "")
        .option("-a, --auth <string>", "The Github OAuth 2.0 token", "")
        .action(create)

    return ceremony
}

export default setCeremonyCommands
