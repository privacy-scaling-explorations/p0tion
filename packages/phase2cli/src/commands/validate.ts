import { parseCeremonyFile } from "@p0tion/actions"
import { showError } from "../lib/errors.js"

/**
 * Validate ceremony setup command.
 */
const validate = async (cmd: { template: string, constraints?: number }) => {
    try {
        // parse the file and cleanup after
        const parsedFile = await parseCeremonyFile(cmd.template, true)
        // check whether we have a constraints option otherwise default to 1M
        const constraints = cmd.constraints || 1000000
        for await (const circuit of parsedFile.circuits) {
            if (circuit.metadata.constraints > constraints) {
                console.log(false)
                process.exit(0)
            }
        }

        console.log(true)

    } catch (err: any) {
        showError(`${err.toString()}`, false)
        // we want to exit with a non-zero exit code
        process.exit(1)
    }
}

export default validate
