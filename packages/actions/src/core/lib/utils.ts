import { genesisZkeyIndex } from "../../helpers/constants"

/**
 * Get the powers from pot file name
 * @dev the pot files must follow these convention (i_am_a_pot_file_09.ptau) where the numbers before '.ptau' are the powers.
 * @param potFileName <string>
 * @returns <number>
 */
export const extractPoTFromFilename = (potFileName: string): number =>
    Number(potFileName.split("_").pop()?.split(".").at(0))

/**
 * Format the next zkey index.
 * @param progress <number> - the progression in zkey index (= contributions).
 * @returns <string>
 */
export const formatZkeyIndex = (progress: number): string => {
    let index = progress.toString()

    while (index.length < genesisZkeyIndex.length) {
        index = `0${index}`
    }

    return index
}
