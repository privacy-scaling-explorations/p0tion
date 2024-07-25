import { commonTerms } from "@p0tion/actions"
import Conf from "conf"
import { dirname } from "path"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"

// Get npm package name.
const packagePath = `${dirname(fileURLToPath(import.meta.url))}/..`
const { name } = JSON.parse(
    readFileSync(
        packagePath.includes(`src/lib/`) ? `${packagePath}/../package.json` : `${packagePath}/package.json`,
        "utf8"
    )
)

/**
 * Local Storage.
 * @dev The CLI implementation use the Conf package to create a local storage
 * in the user device (`.config/@p0tion/phase2cli-nodejs/config.json` path) to store the access token.
 */
const config = new Conf({
    projectName: name,
    schema: {
        accessToken: {
            type: "string",
            default: ""
        },
        bandadaIdentity: {
            type: "string",
            default: ""
        },
        authMethod: {
            type: "string",
            default: ""
        },
        jwtToken: {
            type: "string",
            default: ""
        },
        githubAccessToken: {
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
const wasmLocalFolderPath = `${setupLocalFolderPath}/${commonTerms.foldersAndPathsTerms.wasm}`
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
    wasm: wasmLocalFolderPath,
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
 * Return the Bandada identity, if present.
 * @returns <string | undefined> - the Bandada identity if present, otherwise undefined.
 */
export const getLocalBandadaIdentity = (): string | unknown => config.get("bandadaIdentity")

/**
 * Check if the Bandada identity exists in the local storage.
 * @returns <boolean>
 */
export const checkLocalBandadaIdentity = (): boolean => config.has("bandadaIdentity") && !!config.get("bandadaIdentity")

/**
 * Set the Bandada identity.
 * @param identity <string> - the Bandada identity to be stored.
 */
export const setLocalBandadaIdentity = (identity: string) => config.set("bandadaIdentity", identity)

/**
 * Delete the stored Bandada identity.
 */
export const deleteLocalBandadaIdentity = () => config.delete("bandadaIdentity")

/**
 * Return the authentication method, if present.
 * @returns <string | undefined> - the authentication method if present, otherwise undefined.
 */
export const getLocalAuthMethod = (): string | unknown => config.get("authMethod")

/**
 * Check if the authentication method exists in the local storage.
 * @returns <boolean>
 */
export const checkLocalAuthMethod = (): boolean => config.has("authMethod") && !!config.get("authMethod")

/**
 * Set the authentication method.
 * @param method <string> - the authentication method to be stored.
 */
export const setLocalAuthMethod = (method: string) => config.set("authMethod", method)

/**
 * Delete the stored authentication method.
 */
export const deleteLocalAuthMethod = () => config.delete("authMethod")

export const getJWTToken = (): string | unknown => config.get("jwtToken")

export const setJWTToken = (token: string) => config.set("jwtToken", token)

export const deleteJWTToken = () => config.delete("jwtToken")

export const checkJWTToken = (): boolean => config.has("jwtToken") && !!config.get("jwtToken")

export const getGithubAccessToken = (): string | unknown => config.get("githubAccessToken")

export const setGithubAccessToken = (token: string) => config.set("githubAccessToken", token)

export const deleteGithubAccessToken = () => config.delete("githubAccessToken")

export const checkGithubAccessToken = (): boolean =>
    config.has("githubAccessToken") && !!config.get("githubAccessToken")

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
