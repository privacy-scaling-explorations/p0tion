import { terms } from "@zkmpc/actions"
import { collections } from "./constants"

/** LOCAL PATHS */
export const outputLocalFolderPath = `./${terms.output}`
export const setupLocalFolderPath = `${outputLocalFolderPath}/${terms.setup}`
export const contributeLocalFolderPath = `${outputLocalFolderPath}/${terms.contribute}`
export const finalizeLocalFolderPath = `${outputLocalFolderPath}/${terms.finalize}`
export const potLocalFolderPath = `${setupLocalFolderPath}/${terms.pot}`
export const zkeysLocalFolderPath = `${setupLocalFolderPath}/${terms.zkeys}`
export const metadataLocalFolderPath = `${setupLocalFolderPath}/${terms.metadata}`
export const contributionsLocalFolderPath = `${contributeLocalFolderPath}/${terms.zkeys}`
export const contributionTranscriptsLocalFolderPath = `${contributeLocalFolderPath}/${terms.transcripts}`
export const attestationLocalFolderPath = `${contributeLocalFolderPath}/${terms.attestation}`
export const finalZkeysLocalFolderPath = `${finalizeLocalFolderPath}/${terms.zkeys}`
export const finalPotLocalFolderPath = `${finalizeLocalFolderPath}/${terms.pot}`
export const finalTranscriptsLocalFolderPath = `${finalizeLocalFolderPath}/${terms.transcripts}`
export const finalAttestationsLocalFolderPath = `${finalizeLocalFolderPath}/${terms.attestation}`
export const verificationKeysLocalFolderPath = `${finalizeLocalFolderPath}/${terms.vkeys}`
export const verifierContractsLocalFolderPath = `${finalizeLocalFolderPath}/${terms.verifiers}`

export const getCWDFilePath = (cwd: string, completeFilename: string): string => `${cwd}/${completeFilename}`
export const getMetdataLocalFilePath = (completeFilename: string): string =>
    `${metadataLocalFolderPath}/${completeFilename}`
export const getPotLocalFilePath = (completeFilename: string): string => `${potLocalFolderPath}/${completeFilename}`
export const getZkeysLocalFilePath = (completeFilename: string): string => `${zkeysLocalFolderPath}/${completeFilename}`

/** STORAGE PATHS */

/**
 * Get R1CS file path tied to a particular circuit of a ceremony in the storage.
 * @notice each R1CS file in the storage must be stored in the following path: `circuits/<circuitPrefix>/<completeR1csFilename>`.
 * nb. This is a rule that must be satisfied. This is NOT an optional convention.
 * @param circuitPrefix <string> - the prefix of the circuit.
 * @param completeR1csFilename <string> - the complete R1CS filename (name + ext).
 * @returns <string> - the storage path of the R1CS file.
 */
export const getR1csStorageFilePath = (circuitPrefix: string, completeR1csFilename: string): string =>
    `${collections.circuits}/${circuitPrefix}/${completeR1csFilename}`

/**
 * Get PoT file path in the storage.
 * @notice each PoT file in the storage must be stored in the following path: `pot/<completePotFilename>`.
 * nb. This is a rule that must be satisfied. This is NOT an optional convention.
 * @param completePotFilename <string> - the complete PoT filename (name + ext).
 * @returns <string> - the storage path of the PoT file.
 */
export const getPotStorageFilePath = (completePotFilename: string): string => `${terms.pot}/${completePotFilename}`

/**
 * Get zKey file path tied to a particular circuit of a ceremony in the storage.
 * @notice each zKey file in the storage must be stored in the following path: `circuits/<circuitPrefix>/contributions/<completeZkeyFilename>`.
 * nb. This is a rule that must be satisfied. This is NOT an optional convention.
 * @param completeZkeyFilename <string> - the complete zKey filename (name + ext).
 * @returns <string> - the storage path of the zKey file.
 */
export const getZkeyStorageFilePath = (circuitPrefix: string, completeZkeyFilename: string): string =>
    `${collections.circuits}/${circuitPrefix}/${collections.contributions}/${completeZkeyFilename}`
