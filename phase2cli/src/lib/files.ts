import fs, { Dirent } from "fs"
import { createWriteStream } from "node:fs"
import { pipeline } from "node:stream"
import { promisify } from "node:util"
import fetch from "node-fetch"
import path from "path"
import { fileURLToPath } from "url"

/**
 * Check a directory path
 * @param filePath <string> - the absolute or relative path.
 * @returns <boolean> true if the path exists, otherwise false.
 */
export const directoryExists = (filePath: string): boolean => fs.existsSync(filePath)

/**
 * Write a new file locally.
 * @param path <string> - local path for file with extension.
 * @param data <Buffer> - content to be written.
 */
export const writeFile = (path: string, data: Buffer): void => fs.writeFileSync(path, data)

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

  // Return Dirent sub paths for files only.
  return subPaths.filter((dirent: Dirent) => dirent.isFile())
}

/**
 * Return the matching sub path with the given file name.
 * @param subPaths <Array<Dirent>> - the list of dirents subpaths.
 * @param fileNameToMatch <string> - the name of the file to be matched.
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

/**
 * Read a local .json file at a given path.
 * @param filePath <string>
 * @returns <any>
 */
export const readLocalJsonFile = (filePath: string): any => {
  const filename = fileURLToPath(import.meta.url)
  const dirname = path.dirname(filename)

  return readJSONFile(path.join(dirname, filePath))
}

/**
 * Check if a directory at given path is empty or not.
 * @param dirPath <string> - the absolute or relative path to the directory.
 * @returns <Promise<boolean>>
 */
export const checkIfDirectoryIsEmpty = async (dirPath: string): Promise<boolean> => {
  const dirNumberOfFiles = await getDirFilesSubPaths(dirPath)

  return !(dirNumberOfFiles.length > 0)
}

/**
 * Download a file from url.
 * @param dest <string> - the location where the downloaded file will be stored.
 * @param url <string> - the download url.
 */
export const downloadFileFromUrl = async (dest: string, url: string): Promise<void> => {
  const streamPipeline = promisify(pipeline)

  const response = await fetch(url)

  if (!response.ok) throw new Error(`unexpected response ${response.statusText}`)

  if (response.body) await streamPipeline(response.body, createWriteStream(dest))
}
