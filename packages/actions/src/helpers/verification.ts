import { DocumentData, Firestore } from "firebase/firestore"
import { FirebaseDocumentInfo } from "../../types"
import { getCurrentContributorContribution } from "./query"

/**
 * Return an array of true of false based on contribution verification result per each circuit.
 * @param firestore <Firestore> - the Firestore db.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param participantId <string> - the unique identifier of the contributor.
 * @param circuits <Array<FirebaseDocumentInfo>> - the Firestore documents of the ceremony circuits.
 * @param finalize <boolean> - true when finalizing; otherwise false.
 * @returns <Promise<Array<boolean>>>
 */
export const getContributorContributionsVerificationResults = async (
    firestoreDatabase: Firestore,
    ceremonyId: string,
    participantId: string,
    circuits: Array<FirebaseDocumentInfo>,
    finalize: boolean
): Promise<Array<boolean>> => {
    // Keep track contributions verification results.
    const contributions: Array<boolean> = []

    // Retrieve valid/invalid contributions.
    for await (const circuit of circuits) {
        // Get contributions to circuit from contributor.
        const contributionsToCircuit = await getCurrentContributorContribution(
            firestoreDatabase,
            ceremonyId, 
            circuit.id, 
            participantId
        )

        let contribution: FirebaseDocumentInfo

        if (finalize)
            // There should be two contributions from coordinator (one is finalization).
            contribution = contributionsToCircuit
                .filter((contrib: FirebaseDocumentInfo) => contrib.data.zkeyIndex === "final")
                .at(0)!
        // There will be only one contribution.
        else contribution = contributionsToCircuit.at(0)!

        if (contribution) {
            // Get data.
            const contributionData = contribution.data

            if (!contributionData) throw new Error('Verification-0001: Something went wrong when retrieving the data from the database') 

            // Update contributions validity.
            contributions.push(!!contributionData?.valid)
        }
    }

    return contributions
}

/**
 * Return the attestation made only from valid contributions.
 * @param firestoreDatabase <Firestore> - the Firestore db object.
 * @param contributionsValidities Array<boolean> - an array of booleans (true when contribution is valid; otherwise false).
 * @param circuits <Array<FirebaseDocumentInfo>> - the Firestore documents of the ceremony circuits.
 * @param participantData <DocumentData> - the document data of the participant.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param participantId <string> - the unique identifier of the contributor.
 * @param attestationPreamble <string> - the preamble of the attestation.
 * @param finalize <boolean> - true only when finalizing, otherwise false.
 * @returns <Promise<string>> - the complete attestation string.
 */
export const getValidContributionAttestation = async (
    firestoreDatabase: Firestore,
    contributionsValidities: Array<boolean>,
    circuits: Array<FirebaseDocumentInfo>,
    participantData: DocumentData,
    ceremonyId: string,
    participantId: string,
    attestationPreamble: string,
    finalize: boolean
): Promise<string> => {
    let attestation = attestationPreamble

    // For each contribution validity.
    for (let idx = 0; idx < contributionsValidities.length; idx += 1) {
        if (contributionsValidities[idx]) {
            // Extract data from circuit.
            const circuit = circuits[idx]

            let contributionHash: string = ""

            // Get the contribution hash.
            if (finalize) {
                const numberOfContributions = participantData.contributions.length
                contributionHash = participantData.contributions[numberOfContributions / 2 + idx].hash
            } else contributionHash = participantData.contributions[idx].hash

            // Get the contribution data.
            const contributions = await getCurrentContributorContribution(firestoreDatabase, ceremonyId, circuit.id, participantId)

            let contributionData: DocumentData

            if (finalize)
                contributionData = contributions.filter(
                    (contribution: FirebaseDocumentInfo) => contribution.data.zkeyIndex === "final"
                )[0].data!
            else contributionData = contributions.at(0)?.data!

            // Attestate.
            attestation = `${attestation}\n\nCircuit # ${circuit.data.sequencePosition} (${
                circuit.data.prefix
            })\nContributor # ${
                contributionData?.zkeyIndex > 0 ? Number(contributionData?.zkeyIndex) : contributionData?.zkeyIndex
            }\n${contributionHash}`
        }
    }

    return attestation
}