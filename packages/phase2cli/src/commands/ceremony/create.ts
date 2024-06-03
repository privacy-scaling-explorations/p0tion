import { parseCeremonyFile } from "@p0tion/actions"
import { checkAndMakeNewDirectoryIfNonexistent, cleanDir } from "../../lib/files"
import { localPaths } from "../../lib/localConfigs"
import theme from "../../lib/theme"
import { customSpinner } from "../../lib/utils"
import { createBucket, createCeremony } from "../../lib-api/ceremony"

const create = async (cmd: { template?: string; auth?: string }) => {
    // TODO: check auth token exists
    // Get current working directory.
    const cwd = process.cwd()
    console.log(cwd)

    console.log(
        `${theme.symbols.warning} To setup a zkSNARK Groth16 Phase 2 Trusted Setup ceremony you need to have the Rank-1 Constraint System (R1CS) file for each circuit in your working directory`
    )
    console.log(
        `\n${theme.symbols.info} Your current working directory is ${theme.text.bold(
            theme.text.underlined(process.cwd())
        )}\n`
    )

    // Prepare local directories.
    checkAndMakeNewDirectoryIfNonexistent(localPaths.output)
    cleanDir(localPaths.setup)
    cleanDir(localPaths.pot)
    cleanDir(localPaths.zkeys)
    cleanDir(localPaths.wasm)
    // if there is the file option, then set up the non interactively
    if (cmd.template) {
        // 1. parse the file
        // tmp data - do not cleanup files as we need them
        const spinner = customSpinner(`Parsing ${theme.text.bold(cmd.template!)} setup configuration file...`, `clock`)
        spinner.start()
        const setupCeremonyData = await parseCeremonyFile(cmd.template!)
        spinner.succeed(`Parsing of ${theme.text.bold(cmd.template!)} setup configuration file completed successfully`)

        // final setup data
        const ceremonySetupData = setupCeremonyData
        // create ceremony
        const { id: ceremonyId } = await createCeremony(ceremonySetupData)
        // create bucket
        const { bucketName } = await createBucket(ceremonyId)
        console.log(`\n${theme.symbols.success} Ceremony bucket name: ${theme.text.bold(bucketName)}`)
        // TODO: upload circuits to bucket
        // TODO: create circuits in ceremony
    } else {
        // TODO: complete this
    }
}

export default create
