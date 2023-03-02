import fs from "fs"
import { zKey } from "snarkjs"

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
