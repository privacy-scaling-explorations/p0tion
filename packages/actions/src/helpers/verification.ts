import { groth16, zKey } from "snarkjs"
import fs from "fs"
import { Firestore, where } from "firebase/firestore"
import { Functions } from "firebase/functions"
import {
    numExpIterations,
    commonTerms,
    finalContributionIndex,
    verifierSmartContractAcronym,
    verificationKeyAcronym,
    solidityVersion
} from "./constants"
import { compareHashes } from "./crypto"
import {
    downloadCeremonyArtifact,
    getBucketName,
    getVerificationKeyStorageFilePath,
    getVerifierContractStorageFilePath,
    getWasmStorageFilePath,
    getZkeyStorageFilePath
} from "./storage"
import {
    fromQueryToFirebaseDocumentInfo,
    getCeremonyCircuits,
    getCircuitContributionsFromContributor,
    queryCollection
} from "./database"
import { formatZkeyIndex } from "./utils"
import { CeremonyArtifacts } from "../types/index"

/**
 * Verify that a zKey is valid
 * @param r1csLocalFilePath <string> path to the r1cs file
 * @param zkeyLocalPath <string> path to the zKey file
 * @param potLocalFilePath <string> path to the PoT file
 * @param logger <any> logger instance
 * @returns <boolean> true if the zKey is valid, false otherwise
 */
export const verifyZKey = async (
    r1csLocalFilePath: string,
    zkeyLocalPath: string,
    potLocalFilePath: string,
    logger?: any
): Promise<boolean> => {
    if (!fs.existsSync(r1csLocalFilePath)) throw new Error(`R1CS file not found at ${r1csLocalFilePath}`)

    if (!fs.existsSync(zkeyLocalPath)) throw new Error(`zKey file not found at ${zkeyLocalPath}`)

    if (!fs.existsSync(potLocalFilePath)) throw new Error(`PoT file not found at ${potLocalFilePath}`)

    const res = await zKey.verifyFromR1cs(r1csLocalFilePath, potLocalFilePath, zkeyLocalPath, logger)
    return res
}

/**
 * Generates a GROTH16 proof
 * @param circuitInput <object> Input to the circuit
 * @param zkeyFilePath <string> Path to the proving key
 * @param wasmFilePath <string> Path to the compiled circuit
 * @param logger <any> Optional logger
 * @returns <Promise<object>> The proof
 */
export const generateGROTH16Proof = async (
    circuitInput: object,
    zkeyFilePath: string,
    wasmFilePath: string,
    logger?: any
): Promise<any> => {
    try {
        const { proof, publicSignals } = await groth16.fullProve(circuitInput, wasmFilePath, zkeyFilePath, logger)
        return {
            proof,
            publicSignals
        }
    } catch (error: any) {
        throw new Error(
            "There was an error while generating a proof. Please check that the input is correct, as well as the required system paths; and please try again."
        )
    }
}

/**
 * Verifies a GROTH16 proof
 * @param verificationKeyPath <string> Path to the verification key
 * @param publicSignals <object> Public signals
 * @param proof <object> Proof
 * @returns <Promise<boolean>> Whether the proof is valid or not
 */
export const verifyGROTH16Proof = async (
    verificationKeyPath: string,
    publicSignals: object,
    proof: object
): Promise<boolean> => {
    const verificationKey = JSON.parse(fs.readFileSync(verificationKeyPath).toString())
    const success = await groth16.verify(verificationKey, publicSignals, proof)
    return success
}

/**
 * Helper method to extract the Solidity verifier
 * from a final zKey file and save it to a local file.
 * @param finalZkeyPath <string> The path to the zKey file.
 * @return <any> The Solidity verifier code.
 */
export const exportVerifierContract = async (finalZkeyPath: string, templatePath: string) => {
    // Extract verifier.
    let verifierCode = await zKey.exportSolidityVerifier(
        finalZkeyPath,
        {
            groth16: fs.readFileSync(templatePath).toString()
        },
        console
    )

    // Update solidity version.
    verifierCode = verifierCode.replace(/pragma solidity \^\d+\.\d+\.\d+/, `pragma solidity ^${solidityVersion}`)

    return verifierCode
}

/**
 * Helpers method to extract the vKey from a final zKey file
 * @param finalZkeyPath <string> The path to the zKey file.
 * @return <any> The vKey.
 */
export const exportVkey = async (finalZkeyPath: string) => {
    const verificationKeyJSONData = await zKey.exportVerificationKey(finalZkeyPath)
    return verificationKeyJSONData
}

/**
 * Helper method to extract the Solidity verifier and the Verification key
 * from a final zKey file and save them to local files.
 * @param finalZkeyPath <string> The path to the zKey file.
 * @param verifierLocalPath <string> The path to the local file where the verifier will be saved.
 * @param vKeyLocalPath <string> The path to the local file where the vKey will be saved.
 * @param templatePath <string> The path to the template file.
 */
export const exportVerifierAndVKey = async (
    finalZkeyPath: string,
    verifierLocalPath: string,
    vKeyLocalPath: string,
    templatePath: string
) => {
    const verifierCode = await exportVerifierContract(finalZkeyPath, templatePath)
    fs.writeFileSync(verifierLocalPath, verifierCode)
    const verificationKeyJSONData = await exportVkey(finalZkeyPath)
    fs.writeFileSync(vKeyLocalPath, JSON.stringify(verificationKeyJSONData))
}

/**
 * Generate a zKey from scratch (useful to compute either the genesis or final zKey)
 * @param isFinalizing <boolean> Whether the ceremony is finalizing or not
 * @param r1csLocalPath <string> The path to the local r1cs file
 * @param potLocalPath <string> The path to the local pot file
 * @param zkeyLocalPath <string> The path to save the generated zKey
 * @param logger <any> The logger instance
 * @param finalContributionZKeyLocalPath <string> The path to the local zkey file of the final contribution (only for final zKey)
 * @param coordinatorIdentifier <string> The identifier of the coordinator (only for final zKey)
 * @param beacon <string> The beacon value for the last contribution (only for final zKey)
 */
export const generateZkeyFromScratch = async (
    isFinalizing: boolean,
    r1csLocalPath: string,
    potLocalPath: string,
    zkeyLocalPath: string,
    logger: any,
    finalContributionZKeyLocalPath?: string,
    coordinatorIdentifier?: string,
    beacon?: string
) => {
    if (!fs.existsSync(r1csLocalPath) || !fs.existsSync(potLocalPath))
        throw new Error(
            "There was an error while opening the local files. Please make sure that you provided the right paths and try again."
        )

    if (isFinalizing) {
        if (!fs.existsSync(finalContributionZKeyLocalPath!))
            throw new Error(
                "There was an error while opening the last zKey generated by a contributor. Please make sure that you provided the right path and try again."
            )
        await zKey.beacon(
            finalContributionZKeyLocalPath,
            zkeyLocalPath,
            coordinatorIdentifier,
            beacon,
            numExpIterations,
            logger
        )
    } else await zKey.newZKey(r1csLocalPath, potLocalPath, zkeyLocalPath, logger)
}

/**
 * Helper function used to compare two ceremony artifacts
 * @param firebaseFunctions <Functions> Firebase functions object
 * @param localPath1 <string> Local path to store the first artifact
 * @param localPath2 <string> Local path to store the second artifact
 * @param storagePath1 <string> Storage path to the first artifact
 * @param storagePath2 <string> Storage path to the second artifact
 * @param bucketName1 <string> Bucket name of the first artifact
 * @param bucketName2 <string> Bucket name of the second artifact
 * @param cleanup <boolean> Whether to delete the downloaded files or not
 * @returns <Promise<boolean>> true if the hashes match, false otherwise
 */
export const compareCeremonyArtifacts = async (
    firebaseFunctions: Functions,
    localPath1: string,
    localPath2: string,
    storagePath1: string,
    storagePath2: string,
    bucketName1: string,
    bucketName2: string,
    cleanup: boolean
): Promise<boolean> => {
    // 1. download files
    await downloadCeremonyArtifact(firebaseFunctions, bucketName1, storagePath1, localPath1)
    await downloadCeremonyArtifact(firebaseFunctions, bucketName2, storagePath2, localPath2)
    // 2. compare hashes
    const res = await compareHashes(localPath1, localPath2)
    // 3. cleanup
    if (cleanup) {
        fs.unlinkSync(localPath1)
        fs.unlinkSync(localPath2)
    }
    // 4. return result
    return res
}

/**
 * Given a ceremony prefix, download all the ceremony artifacts
 * @param functions <Functions> firebase functions instance
 * @param firestore <Firestore> firebase firestore instance
 * @param ceremonyPrefix <string> ceremony prefix
 * @param outputDirectory <string> output directory where to
 * @returns <Promise<CeremonyArtifacts[]>> array of ceremony artifacts
 */
export const downloadAllCeremonyArtifacts = async (
    functions: Functions,
    firestore: Firestore,
    ceremonyPrefix: string,
    outputDirectory: string
): Promise<CeremonyArtifacts[]> => {
    // mkdir if not exists
    if (!fs.existsSync(outputDirectory)) {
        fs.mkdirSync(outputDirectory)
    }

    if (!process.env.CONFIG_CEREMONY_BUCKET_POSTFIX)
        throw new Error("CONFIG_CEREMONY_BUCKET_POSTFIX not set. Please review your env file and try again.")

    const ceremonyArtifacts: CeremonyArtifacts[] = []

    // find the ceremony given the prefix
    const ceremonyQuery = await queryCollection(firestore, commonTerms.collections.ceremonies.name, [
        where(commonTerms.collections.ceremonies.fields.prefix, "==", ceremonyPrefix)
    ])
    // get the data
    const ceremonyData = fromQueryToFirebaseDocumentInfo(ceremonyQuery.docs)
    if (ceremonyData.length === 0)
        throw new Error("Ceremony not found. Please review your ceremony prefix and try again.")
    const ceremony = ceremonyData.at(0)!
    // reconstruct the bucket name
    const bucketName = getBucketName(ceremonyPrefix, process.env.CONFIG_CEREMONY_BUCKET_POSTFIX!)

    const circuits = await getCeremonyCircuits(firestore, ceremony.id)
    if (circuits.length === 0)
        throw new Error("No circuits found for this ceremony. Please review your ceremony prefix and try again.")

    // for each circuit we have to download artifacts
    for (const circuit of circuits) {
        // make a directory for storing the circuit artifacts
        const circuitDir = `${outputDirectory}/${ceremony.data.prefix}/${circuit.data.prefix}`
        fs.mkdirSync(circuitDir, { recursive: true })

        // get all required file names in storage and for local storage
        const { potStoragePath } = circuit.data.files
        const potLocalPath = `${circuitDir}/${circuit.data.files.potFilename}`
        const { r1csStoragePath } = circuit.data.files
        const r1csLocalPath = `${circuitDir}/${circuit.data.files.r1csFilename}`
        const contributions = circuit.data.waitingQueue.completedContributions
        const zkeyIndex = formatZkeyIndex(contributions)
        const lastZKeyStoragePath = getZkeyStorageFilePath(
            circuit.data.prefix,
            `${circuit.data.prefix}_${zkeyIndex}.zkey`
        )
        const lastZKeyLocalPath = `${circuitDir}/${circuit.data.prefix}_${zkeyIndex}.zkey`
        const finalZKeyName = `${circuit.data.prefix}_${finalContributionIndex}.zkey`
        const finalZkeyStoragePath = getZkeyStorageFilePath(circuit.data.prefix, finalZKeyName)
        const finalZKeyLocalPath = `${circuitDir}/${finalZKeyName}`

        const verifierStoragePath = getVerifierContractStorageFilePath(
            circuit.data.prefix,
            `${verifierSmartContractAcronym}.sol`
        )
        const verifierLocalPath = `${circuitDir}/${circuit.data.prefix}_${verifierSmartContractAcronym}.sol`

        const vKeyStoragePath = getVerificationKeyStorageFilePath(circuit.data.prefix, `${verificationKeyAcronym}.json`)
        const vKeyLocalPath = `${circuitDir}/${circuit.data.prefix}_${verificationKeyAcronym}.json`

        const wasmStoragePath = getWasmStorageFilePath(circuit.data.prefix, `${circuit.data.prefix}.wasm`)
        const wasmLocalPath = `${circuitDir}/${circuit.data.prefix}.wasm`

        // download everything
        await downloadCeremonyArtifact(functions, bucketName, potStoragePath, potLocalPath)
        await downloadCeremonyArtifact(functions, bucketName, r1csStoragePath, r1csLocalPath)
        await downloadCeremonyArtifact(functions, bucketName, lastZKeyStoragePath, lastZKeyLocalPath)
        await downloadCeremonyArtifact(functions, bucketName, finalZkeyStoragePath, finalZKeyLocalPath)
        await downloadCeremonyArtifact(functions, bucketName, verifierStoragePath, verifierLocalPath)
        await downloadCeremonyArtifact(functions, bucketName, vKeyStoragePath, vKeyLocalPath)
        await downloadCeremonyArtifact(functions, bucketName, wasmStoragePath, wasmLocalPath)

        ceremonyArtifacts.push({
            circuitPrefix: circuit.data.prefix,
            circuitId: circuit.id,
            directoryRoot: circuitDir,
            potLocalFilePath: potLocalPath,
            r1csLocalFilePath: r1csLocalPath,
            finalZkeyLocalFilePath: finalZKeyLocalPath,
            lastZkeyLocalFilePath: lastZKeyLocalPath,
            verifierLocalFilePath: verifierLocalPath,
            verificationKeyLocalFilePath: vKeyLocalPath,
            wasmLocalFilePath: wasmLocalPath
        })
    }

    return ceremonyArtifacts
}

/**
 * Fetch the final contribution beacon from Firestore
 * @param firestore <Firestore> firebase firestore instance
 * @param ceremonyId <string> ceremony id
 * @param circuitId <string> circuit id
 * @param participantId <string> participant id
 * @returns <Promise<string>> final contribution beacon
 */
export const getFinalContributionBeacon = async (
    firestore: Firestore,
    ceremonyId: string,
    circuitId: string,
    participantId: string
): Promise<string> => {
    const contributions = await getCircuitContributionsFromContributor(firestore, ceremonyId, circuitId, participantId)

    const filtered = contributions
        .filter((contributionDocument: any) => contributionDocument.data.zkeyIndex === finalContributionIndex)
        .at(0)
    if (!filtered)
        throw new Error(
            "Final contribution not found. Please check that you provided the correct input data and try again."
        )

    return filtered.data.beacon.value
}
