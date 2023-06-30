/**
 * Sleeps the function execution for given millis.
 * @dev to be used in combination with loggers when writing data into files.
 * @param ms <number> - sleep amount in milliseconds
 * @returns <Promise<any>>
 */
export const sleep = (ms: any) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Return a pseudo random string of numeric values of specified length.
 * @param length <string> - the number of values.
 * @returns <string> - a pseudo random string of numeric values.
 */
export const generatePseudoRandomStringOfNumbers = (length: number): string => Math.random().toString(length)
