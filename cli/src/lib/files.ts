import fs, { Dirent } from "fs"

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
 * Return the sub paths for each file stored in the given directory.
 * @param dirPath - the path which identifies the directory.
 * @returns
 */
export const getDirFilesSubPaths = async (dirPath: string): Promise<Array<Dirent>> => {
  // Get Dirent sub paths for folders and files.
  const subPaths = await fs.promises.readdir(dirPath, { withFileTypes: true })

  if (!subPaths.length) throw new Error(`Please remember to put the relevant files in the \`${dirPath}\` folder!`)

  // Return Dirent sub paths for files only.
  return subPaths.filter((dirent: Dirent) => dirent.isFile())
}

/**
 * Return the matching sub path with the given file name.
 * @param subPaths <Array<Dirent>>
 * @param fileNameToMatch <string>
 * @returns <string>
 */
export const getMatchingSubPathFile = (subPaths: Array<Dirent>, fileNameToMatch: string): string => {
  // Filter.
  const matchingPaths = subPaths.filter((subpath: Dirent) => subpath.name === fileNameToMatch)

  // Check.
  if (!matchingPaths.length) throw new Error(`${fileNameToMatch} not found!`)

  // Return file name.
  return matchingPaths[0].name
}

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
