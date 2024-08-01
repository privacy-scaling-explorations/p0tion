import { Command } from "commander"
import listParticipants from "./listParticipants.js"
import create from "./create.js"
import contribute from "./contribute.js"
import finalize from "./finalize.js"

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
        .option("-a, --auth <string>", "The JWT access token", "")
        .action(create)

    ceremony
        .command("contribute")
        .description("compute contributions for a Phase2 Trusted Setup ceremony circuits")
        .option("-c, --ceremony <string>", "the prefix of the ceremony you want to contribute for", "")
        .option("-e, --entropy <string>", "the entropy (aka toxic waste) of your contribution", "")
        .option("-a, --auth <string>", "the JWT access token", "")
        .action(contribute)

    ceremony
        .command("finalize")
        .description("finalize a ceremony")
        .option("-a, --auth <string>", "The JWT access token", "")
        .action(finalize)

    return ceremony
}

export default setCeremonyCommands
