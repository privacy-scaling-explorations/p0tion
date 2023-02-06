/**
 * Extract a prefix consisting of alphanumeric and underscore characters from a string with arbitrary characters.
 * @dev replaces all special symbols and whitespaces with an underscore char ('_'). Convert all uppercase chars to lowercase.
 * @notice example: str = 'Multiplier-2!2.4.zkey'; output prefix = 'multiplier_2_2_4.zkey'.
 * NB. Prefix extraction is a key process that conditions the name of the ceremony artifacts, download/upload from/to storage, collections paths.
 * @param str <string> - the arbitrary string from which to extract the prefix.
 * @returns <string> - the resulting prefix.
 */
export const extractPrefix = (str: string): string =>
    // eslint-disable-next-line no-useless-escape
    str.replace(/[`\s~!@#$%^&*()|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, "-").toLowerCase()
