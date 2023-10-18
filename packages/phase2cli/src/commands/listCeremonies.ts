import { commonTerms, getAllCollectionDocs } from "@p0tion/actions"
import { showError } from "../lib/errors.js"
import { bootstrapCommandExecutionAndServices } from "../lib/services.js"

/**
 * Validate ceremony setup command.
 */
const listCeremonies = async () => {
    try {
        // bootstrap command execution and services
        const { firestoreDatabase } = await bootstrapCommandExecutionAndServices()

        // get all ceremonies
        const ceremonies = await getAllCollectionDocs(firestoreDatabase, commonTerms.collections.ceremonies.name)
        // store all names
        const names: string[] = []

        // loop through all ceremonies
        for (const ceremony of ceremonies) names.push(ceremony.data().prefix)

        // print them to the console
        console.log(names.join(", "))
        process.exit(0)
    } catch (err: any) {
        showError(`${err.toString()}`, false)
        // we want to exit with a non-zero exit code
        process.exit(1)
    }
}

export default listCeremonies
