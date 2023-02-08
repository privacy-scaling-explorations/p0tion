import { CeremonyInputData, CircuitDocument } from "@zkmpc/actions/src/types"

/**
 * Group all the necessary data needed for running the `setupCeremony` cloud function.
 * @typedef {Object} SetupCeremonyData
 * @property {CeremonyInputData} ceremonyInputData - the necessary input data for setup a new ceremony.
 * @property {string} ceremonyPrefix - the ceremony prefix.
 * @property {Array<CircuitDocument>} circuits - the necessary input data for setup the related ceremony circuits.
 */
export type SetupCeremonyData = {
    ceremonyInputData: CeremonyInputData
    ceremonyPrefix: string
    circuits: Array<CircuitDocument>
}
