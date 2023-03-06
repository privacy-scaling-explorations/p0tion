import { commonTerms } from "@zkmpc/actions/src"
import Conf from "conf"
import { readLocalJsonFile } from "./files"

// Get npm package name.
const { name } = readLocalJsonFile("../../package.json")

/**
 * Local Storage.
 * @dev The CLI implementation use the Conf package to create a local storage
 * in the user device (`.config/@zkmpc/phase2cli-nodejs/config.json` path) to store the access token.
 */
const config = new Conf({
    projectName: name,
    schema: {
        accessToken: {
            type: "string",
            default: ""
        }
    }
})

/**
 * Local Paths.
 * @dev definition of the paths to the local folders containing the CLI-generated artifacts.
 */
const outputLocalFolderPath = `./${commonTerms.foldersAndPathsTerms.output}`
const setupLocalFolderPath = `${outputLocalFolderPath}/${commonTerms.foldersAndPathsTerms.setup}`
const contributeLocalFolderPath = `${outputLocalFolderPath}/${commonTerms.foldersAndPathsTerms.contribute}`
const finalizeLocalFolderPath = `${outputLocalFolderPath}/${commonTerms.foldersAndPathsTerms.finalize}`
const potLocalFolderPath = `${setupLocalFolderPath}/${commonTerms.foldersAndPathsTerms.pot}`
const zkeysLocalFolderPath = `${setupLocalFolderPath}/${commonTerms.foldersAndPathsTerms.zkeys}`
const contributionsLocalFolderPath = `${contributeLocalFolderPath}/${commonTerms.foldersAndPathsTerms.zkeys}`
const contributionTranscriptsLocalFolderPath = `${contributeLocalFolderPath}/${commonTerms.foldersAndPathsTerms.transcripts}`
const attestationLocalFolderPath = `${contributeLocalFolderPath}/${commonTerms.foldersAndPathsTerms.attestation}`
const finalZkeysLocalFolderPath = `${finalizeLocalFolderPath}/${commonTerms.foldersAndPathsTerms.zkeys}`
const finalPotLocalFolderPath = `${finalizeLocalFolderPath}/${commonTerms.foldersAndPathsTerms.pot}`
const finalTranscriptsLocalFolderPath = `${finalizeLocalFolderPath}/${commonTerms.foldersAndPathsTerms.transcripts}`
const finalAttestationsLocalFolderPath = `${finalizeLocalFolderPath}/${commonTerms.foldersAndPathsTerms.attestation}`
const verificationKeysLocalFolderPath = `${finalizeLocalFolderPath}/${commonTerms.foldersAndPathsTerms.vkeys}`
const verifierContractsLocalFolderPath = `${finalizeLocalFolderPath}/${commonTerms.foldersAndPathsTerms.verifiers}`

export const localPaths = {
    output: outputLocalFolderPath,
    setup: setupLocalFolderPath,
    contribute: contributeLocalFolderPath,
    finalize: finalizeLocalFolderPath,
    pot: potLocalFolderPath,
    zkeys: zkeysLocalFolderPath,
    contributions: contributionsLocalFolderPath,
    transcripts: contributionTranscriptsLocalFolderPath,
    attestations: attestationLocalFolderPath,
    finalZkeys: finalZkeysLocalFolderPath,
    finalPot: finalPotLocalFolderPath,
    finalTranscripts: finalTranscriptsLocalFolderPath,
    finalAttestations: finalAttestationsLocalFolderPath,
    verificationKeys: verificationKeysLocalFolderPath,
    verifierContracts: verifierContractsLocalFolderPath
}

/**
 * Return the access token, if present.
 * @returns <string | undefined> - the access token if present, otherwise undefined.
 */
export const getLocalAccessToken = (): string | unknown => config.get("accessToken")

/**
 * Check if the access token exists in the local storage.
 * @returns <boolean>
 */
export const checkLocalAccessToken = (): boolean => config.has("accessToken") && !!config.get("accessToken")

/**
 * Set the access token.
 * @param token <string> - the access token to be stored.
 */
export const setLocalAccessToken = (token: string) => config.set("accessToken", token)

/**
 * Delete the stored access token.
 */
export const deleteLocalAccessToken = () => config.delete("accessToken")

/**
 * Get the complete local file path.
 * @param cwd <string> - the current working directory path.
 * @param completeFilename <string> - the complete filename of the file (name.ext).
 * @returns <string> - the complete local path to the file.
 */
export const getCWDFilePath = (cwd: string, completeFilename: string): string => `${cwd}/${completeFilename}`

/**
 * Get the complete PoT file path.
 * @param completeFilename <string> - the complete filename of the file (name.ext).
 * @returns <string> - the complete PoT path to the file.
 */
export const getPotLocalFilePath = (completeFilename: string): string => `${potLocalFolderPath}/${completeFilename}`

/**
 * Get the complete zKey file path.
 * @param completeFilename <string> - the complete filename of the file (name.ext).
 * @returns <string> - the complete zKey path to the file.
 */
export const getZkeyLocalFilePath = (completeFilename: string): string => `${zkeysLocalFolderPath}/${completeFilename}`

/**
 * Get the complete contribution file path.
 * @param completeFilename <string> - the complete filename of the file (name.ext).
 * @returns <string> - the complete contribution path to the file.
 */
export const getContributionLocalFilePath = (completeFilename: string): string =>
    `${contributionsLocalFolderPath}/${completeFilename}`

/**
 * Get the contribution attestation file path.
 * @param completeFilename <string> - the complete filename of the file (name.ext).
 * @returns <string> - the the contribution attestation path to the file.
 */
export const getAttestationLocalFilePath = (completeFilename: string): string =>
    `${attestationLocalFolderPath}/${completeFilename}`

/**
 * Get the transcript file path.
 * @param completeFilename <string> - the complete filename of the file (name.ext).
 * @returns <string> - the the transcript path to the file.
 */
export const getTranscriptLocalFilePath = (completeFilename: string): string =>
    `${contributionTranscriptsLocalFolderPath}/${completeFilename}`

/**
 * Get the complete final zKey file path.
 * @param completeFilename <string> - the complete filename of the file (name.ext).
 * @returns <string> - the complete final zKey path to the file.
 */
export const getFinalZkeyLocalFilePath = (completeFilename: string): string =>
    `${finalZkeysLocalFolderPath}/${completeFilename}`

/**
 * Get the complete final PoT file path.
 * @param completeFilename <string> - the complete filename of the file (name.ext).
 * @returns <string> - the complete final PoT path to the file.
 */
export const getFinalPotLocalFilePath = (completeFilename: string): string =>
    `${finalPotLocalFolderPath}/${completeFilename}`

/**
 * Get the complete verification key file path.
 * @param completeFilename <string> - the complete filename of the file (name.ext).
 * @returns <string> - the complete final verification key path to the file.
 */
export const getVerificationKeyLocalFilePath = (completeFilename: string): string =>
    `${verificationKeysLocalFolderPath}/${completeFilename}`

/**
 * Get the complete verifier contract file path.
 * @param completeFilename <string> - the complete filename of the file (name.ext).
 * @returns <string> - the complete final verifier contract path to the file.
 */
export const getVerifierContractLocalFilePath = (completeFilename: string): string =>
    `${verifierContractsLocalFolderPath}/${completeFilename}`

/**
 * Get the complete final attestation file path.
 * @param completeFilename <string> - the complete filename of the file (name.ext).
 * @returns <string> - the complete final final attestation path to the file.
 */
export const getFinalAttestationLocalFilePath = (completeFilename: string): string =>
    `${finalAttestationsLocalFolderPath}/${completeFilename}`

/**
 * Get the final transcript file path.
 * @param completeFilename <string> - the complete filename of the file (name.ext).
 * @returns <string> - the the final transcript path to the file.
 */
export const getFinalTranscriptLocalFilePath = (completeFilename: string): string =>
    `${finalTranscriptsLocalFolderPath}/${completeFilename}`
