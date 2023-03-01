import { groth16 } from "snarkjs"
import fs from "fs"

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
