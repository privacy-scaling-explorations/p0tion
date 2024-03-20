import { collection, doc, getDocs } from "firebase/firestore"
import { commonTerms, getAllCeremonies } from "@p0tion/actions"
import { bootstrapCommandExecutionAndServices } from "../../lib/services.js"
import { showError } from "../../lib/errors.js"
import { promptForCeremonySelection } from "../../lib/prompts.js"

const listParticipants = async () => {
    try {
        const { firestoreDatabase } = await bootstrapCommandExecutionAndServices()

        const allCeremonies = await getAllCeremonies(firestoreDatabase)
        const selectedCeremony = await promptForCeremonySelection(allCeremonies, true)

        const docRef = doc(firestoreDatabase, commonTerms.collections.ceremonies.name, selectedCeremony.id)
        const participantsRef = collection(docRef, "participants")
        const participantsSnapshot = await getDocs(participantsRef)
        const participants = participantsSnapshot.docs.map((participantDoc) => participantDoc.data().userId)
        console.log(participants)

        /* const usersRef = collection(firestoreDatabase, "users")
        const usersSnapshot = await getDocs(usersRef)
        const users = usersSnapshot.docs.map((userDoc) => userDoc.data())
        console.log(users) */

        // TODO: finish this command by mergin the participants userId with the users real identifiers
    } catch (err: any) {
        showError(`Something went wrong: ${err.toString()}`, true)
    }
    process.exit(0)
}

export default listParticipants
