import { utils as ffUtils } from "ffjavascript"

/**
 * Formats part of a GROTH16 SNARK proof
 * @link adapted from SNARKJS p256 function
 * @param proofPart <any> a part of a proof to be formatted
 * @returns <string> the formatted proof part
 */
export const p256 = (proofPart: any) => {
    let nProofPart = proofPart.toString(16)
    while (nProofPart.length < 64) nProofPart = `0${nProofPart}`
    nProofPart = `0x${nProofPart}`
    return nProofPart
}

/**
 * This function formats the calldata for Solidity
 * @link adapted from SNARKJS formatSolidityCalldata function
 * @dev this function is supposed to be called with
 * @dev the output of generateGROTH16Proof
 * @param circuitInput <string[]> Inputs to the circuit
 * @param _proof <object> Proof
 * @returns <SolidityCalldata> The calldata formatted for Solidity
 */
export const formatSolidityCalldata = (circuitInput: string[], _proof: any): any => {
    try {
        const proof = ffUtils.unstringifyBigInts(_proof)
        // format the public inputs to the circuit
        const formattedCircuitInput = []
        for (const cInput of circuitInput) {
            formattedCircuitInput.push(p256(ffUtils.unstringifyBigInts(cInput)))
        }
        // construct calldata
        const calldata = {
            arg1: [p256(proof.pi_a[0]), p256(proof.pi_a[1])],
            arg2: [
                [p256(proof.pi_b[0][1]), p256(proof.pi_b[0][0])],
                [p256(proof.pi_b[1][1]), p256(proof.pi_b[1][0])]
            ],
            arg3: [p256(proof.pi_c[0]), p256(proof.pi_c[1])],
            arg4: formattedCircuitInput
        }
        return calldata
    } catch (error: any) {
        throw new Error(
            "There was an error while formatting the calldata. Please make sure that you are calling this function with the output of the generateGROTH16Proof function, and then please try again."
        )
    }
}

/**
 * Verify a GROTH16 SNARK proof on chain
 * @param contract <Contract> The contract instance
 * @param proof <SolidityCalldata> The calldata formatted for Solidity
 * @returns <Promise<boolean>> Whether the proof is valid or not
 */
export const verifyGROTH16ProofOnChain = async (contract: any, proof: any): Promise<boolean> => {
    const res = await contract.verifyProof(proof.arg1, proof.arg2, proof.arg3, proof.arg4)
    return res
}
