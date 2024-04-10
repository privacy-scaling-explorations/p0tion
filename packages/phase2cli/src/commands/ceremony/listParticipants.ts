import { collection, doc, getDocs } from "firebase/firestore"
import { ParticipantDocument, UserDocument, commonTerms, getAllCeremonies } from "@p0tion/actions"
import theme from "../../lib/theme.js"
import { bootstrapCommandExecutionAndServices } from "../../lib/services.js"
import { showError } from "../../lib/errors.js"
import { promptForCeremonySelection } from "../../lib/prompts.js"

const listParticipants = async () => {
    try {
        const { firestoreDatabase } = await bootstrapCommandExecutionAndServices()

        const allCeremonies = await getAllCeremonies(firestoreDatabase)
        const selectedCeremony = await promptForCeremonySelection(
            allCeremonies,
            true,
            "Which ceremony would you like to see participants?"
        )

        const docRef = doc(firestoreDatabase, commonTerms.collections.ceremonies.name, selectedCeremony.id)
        const participantsRef = collection(docRef, "participants")
        const participantsSnapshot = await getDocs(participantsRef)
        const participants = participantsSnapshot.docs.map(
            (participantDoc) => participantDoc.data() as ParticipantDocument
        )

        const usersRef = collection(firestoreDatabase, "users")
        const usersSnapshot = await getDocs(usersRef)
        const users = usersSnapshot.docs.map((userDoc) => {
            const data = userDoc.data() as UserDocument
            return { id: userDoc.id, ...data }
        })

        const participantDetails = participants
            .map((participant) => {
                const user = users.find((_user) => _user.id === participant.userId)
                if (!user) return null
                return {
                    id: user.name,
                    status: participant.status,
                    contributionStep: participant.contributionStep,
                    lastUpdated: new Date(participant.lastUpdated)
                }
            })
            .filter((user) => user !== null)

        const participantsDone = participantDetails.filter((participant) => participant.status === "DONE")
        console.log(participantDetails)
        console.log(`${theme.text.underlined("Total participants:")} ${participantDetails.length}`)
        console.log(`${theme.text.underlined("Total participants finished:")} ${participantsDone.length}`)
    } catch (err: any) {
        showError(`Something went wrong: ${err.toString()}`, true)
    }
    process.exit(0)
}

export default listParticipants
