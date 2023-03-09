import fs from "fs"
import crypto from "crypto"
import blake from "blakejs"

/**
 * @hidden
 */
const toHexByte = (byte: number) => (byte < 0x10 ? `0${byte.toString(16)}` : byte.toString(16))

/**
 * Converts Uint8Array to hexadecimal string.
 * @param buffer arbritrary length of data
 * @returns hexadecimal string
 */
export const toHex = (buffer: Uint8Array): string => Array.from(buffer).map(toHexByte).join("")

/**
 * Get 512 bit blake hash of the contents of given path.
 * @param data buffer or hexadecimal string
 * @returns 64 byte hexadecimal string
 */
export const blake512FromPath = async (path: fs.PathLike): Promise<string> => {
    const context = blake.blake2bInit(64, undefined)

    const hash: string = await new Promise((resolve) => {
        fs.createReadStream(path)
            .on("data", (chunk: Buffer) => {
                blake.blake2bUpdate(context, chunk)
            })
            .on("end", () => {
                resolve(toHex(blake.blake2bFinal(context)))
            })
    })
    return hash
}

/**
 * Return the SHA256 hash (HEX format) of a given value
 * @param value <string> - the value to be hashed.
 * @returns <string> - the HEX format of the SHA256 hash of the given value
 */
export const computeSHA256ToHex = (value: string): string => crypto.createHash("sha256").update(value).digest("hex")

/**
 * Helper function that can be used to compare whether two files' hashes are equal or not.
 * @param path1 <string> Path to the first file.
 * @param path2 <string> Path to the second file.
 * @returns <Promise<boolean>> Whether the files are equal or not.
 */
export const compareHashes = async (path1: string, path2: string): Promise<boolean> => {
    const hash1 = await blake512FromPath(path1)
    const hash2 = await blake512FromPath(path2)

    return hash1 === hash2
}
