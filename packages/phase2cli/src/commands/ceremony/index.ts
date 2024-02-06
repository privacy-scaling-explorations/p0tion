import { Command } from "commander"
import listParticipants from "./listParticipants.js"

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

    return ceremony
}

export default setCeremonyCommands
