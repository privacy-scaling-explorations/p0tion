import { zKey } from "snarkjs"
import fs from "fs"

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
