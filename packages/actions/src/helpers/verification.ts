import { DocumentData, Firestore } from "firebase/firestore"
import { ContributionValidity, FirebaseDocumentInfo } from "../types"
import { finalContributionIndex } from "./constants"
import { getCircuitContributionsFromContributor } from "./database"

/**
 * Get the validity of contributors' contributions for each circuit of the given ceremony (if any).
 * @param firestoreDatabase <Firestore> - the Firestore service instance associated to the current Firebase application.
 * @param circuits <Array<FirebaseDocumentInfo>> - the array of ceremony circuits documents.
 * @param ceremonyId <string> - the unique identifier of the ceremony.
 * @param participantId <string> - the unique identifier of the contributor.
 * @param isFinalizing <boolean> - flag to discriminate between ceremony finalization (true) and contribution (false).
 * @returns <Promise<Array<ContributionValidity>>> - a list of contributor contributions together with contribution validity (based on coordinator verification).
 */
export const getContributionsValidityForContributor = async (
    firestoreDatabase: Firestore,
    circuits: Array<FirebaseDocumentInfo>,
    ceremonyId: string,
    participantId: string,
    isFinalizing: boolean
): Promise<Array<ContributionValidity>> => {
    const contributionsValidity: Array<ContributionValidity> = []

    for await (const circuit of circuits) {
        // Get circuit contribution from contributor.
        const circuitContributionsFromContributor = await getCircuitContributionsFromContributor(
            firestoreDatabase,
            ceremonyId,
            circuit.id,
            participantId
        )

        // Check for ceremony finalization (= there could be more than one contribution).
        const contribution = isFinalizing
            ? circuitContributionsFromContributor
                  .filter(
                      (contributionDocument: FirebaseDocumentInfo) =>
                          contributionDocument.data.zkeyIndex === finalContributionIndex
                  )
                  .at(0)
            : circuitContributionsFromContributor.at(0)

        if (!contribution)
            throw new Error(
                "Unable to retrieve contributions for the participant. There may have occurred a database-side error. Please, we kindly ask you to terminate the current session and repeat the process"
            )

        contributionsValidity.push({
            contributionId: contribution?.id,
            valid: contribution?.data.valid
        })
    }

    return contributionsValidity
}

/**
 * Return the attestation made only from valid contributions.
 * @param firestoreDatabase <Firestore> - the Firestore db object.
 * @param contributionsValidities Array<ContributionValidity> - an array of contributions validity (true when contribution is valid; otherwise false).
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
    contributionsValidities: Array<ContributionValidity>,
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
            const contributions = await getCircuitContributionsFromContributor(
                firestoreDatabase,
                ceremonyId,
                circuit.id,
                participantId
            )

            let contributionData: DocumentData

            if (finalize)
                contributionData = contributions.filter(
                    (contributionDocument: FirebaseDocumentInfo) => contributionDocument.data.zkeyIndex === "final"
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
