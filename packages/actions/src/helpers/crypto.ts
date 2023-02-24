import fs from "fs"

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
