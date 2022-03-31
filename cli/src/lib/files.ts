import fs from "fs"

/**
 * Check a directory path
 * @param filePath <string> - the absolute or relative path.
 * @returns <boolean> true if the path exists, otherwise false.
 */
const directoryExists = (filePath: string): boolean => fs.existsSync(filePath)

/**
 * Write a new file locally.
 * @param path <string> - local path for file with extension.
 * @param data <Buffer> - file content.
 */
export const writeFile = (path: string, data: Buffer): void => {
  fs.writeFileSync(path, data)
}

/**
 * Read a new file from local storage.
 * @param path <string> - local path for file with extension.
 */
export const readFile = (path: string): Buffer => fs.readFileSync(path)

/**
 * Clean a directory specified at a given path.
 * @param dirPath <string> - the directory path.
 */
export const cleanDir = (dirPath: string): void => {
  fs.rmSync(dirPath, { recursive: true, force: true })
  fs.mkdirSync(dirPath)
}

/**
 * Read and return an object of a local JSON file located at a specific path.
 * @param filePath <string> - the absolute or relative path.
 * @returns <any>
 */
export const readJSONFile = (filePath: string): any => {
  if (!directoryExists(filePath)) throw new Error(`Oops, looks like that the provided file path does not exist!`)

  return JSON.parse(fs.readFileSync(filePath).toString())
}
