import { groth16, zKey } from "snarkjs"
import fs from "fs"

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
 * @param solidityVersion <string> The solidity version to include in the verifier pragma definition.
 * @param finalZkeyPath <string> The path to the zKey file.
 * @return <any> The Solidity verifier code.
 */
export const exportVerifierContract = async (solidityVersion: string, finalZkeyPath: string, templatePath: string) => {
    // Extract verifier.
    let verifierCode = await zKey.exportSolidityVerifier(
        finalZkeyPath,
        {
            groth16: fs.readFileSync(templatePath).toString()
        },
        console
    )

    // Update solidity version.
    verifierCode = verifierCode.replace(
        /pragma solidity \^\d+\.\d+\.\d+/,
        `pragma solidity ^${solidityVersion || "0.8.0"}`
    )

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
 * @param solidityVersion <string> The solidity version to include in the verifier pragma definition.
 * @param finalZkeyPath <string> The path to the zKey file.
 * @param verifierLocalPath <string> The path to the local file where the verifier will be saved.
 * @param vKeyLocalPath <string> The path to the local file where the vKey will be saved.
 * @param templatePath <string> The path to the template file.
 */
export const exportVerifierAndVKey = async (
    solidityVersion: string,
    finalZkeyPath: string,
    verifierLocalPath: string,
    vKeyLocalPath: string,
    templatePath: string
) => {
    const verifierCode = await exportVerifierContract(solidityVersion, finalZkeyPath, templatePath)
    fs.writeFileSync(verifierLocalPath, verifierCode)
    const verificationKeyJSONData = await exportVkey(finalZkeyPath)
    fs.writeFileSync(vKeyLocalPath, JSON.stringify(verificationKeyJSONData))
}
