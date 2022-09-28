import fs, { Dirent, Stats } from "fs"
import { createWriteStream } from "node:fs"
import { pipeline } from "node:stream"
import { promisify } from "node:util"
import fetch from "node-fetch"
import path from "path"
import { fileURLToPath } from "url"
import { GENERIC_ERRORS, showError } from "./errors.js"

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
export const readFile = (path: string): string => fs.readFileSync(path, "utf-8")

/**
 * Get back the statistics of the provided file.
 * @param path <string> - local path for file with extension.
 * @returns <Stats>
 */
export const getFileStats = (path: string): Stats => fs.statSync(path)

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
  if (!matchingPaths.length) showError(GENERIC_ERRORS.GENERIC_FILE_ERROR, true)

  // Return file name.
  return matchingPaths[0].name
}

/**
 * Delete a directory specified at a given path.
 * @param dirPath <string> - the directory path.
 */
export const deleteDir = (dirPath: string): void => {
  fs.rmSync(dirPath, { recursive: true, force: true })
}

/**
 * Clean a directory specified at a given path.
 * @param dirPath <string> - the directory path.
 */
export const cleanDir = (dirPath: string): void => {
  deleteDir(dirPath)
  fs.mkdirSync(dirPath)
}

/**
 * Create a new directory in a specified path if not exist in that path.
 * @param dirPath <string> - the directory path.
 */
export const checkAndMakeNewDirectoryIfNonexistent = (dirPath: string): void => {
  if (!directoryExists(dirPath)) fs.mkdirSync(dirPath)
}

/**
 * Read and return an object of a local JSON file located at a specific path.
 * @param filePath <string> - the absolute or relative path.
 * @returns <any>
 */
export const readJSONFile = (filePath: string): any => {
  if (!directoryExists(filePath)) showError(GENERIC_ERRORS.GENERIC_FILE_ERROR, true)

  return JSON.parse(readFile(filePath))
}

/**
 * Write data a local .json file at a given path.
 * @param filePath <string>
 * @param data <JSON>
 */
export const writeLocalJsonFile = (filePath: string, data: JSON) => {
  fs.writeFileSync(filePath, JSON.stringify(data), "utf-8")
}

/**
 * Return the local current project directory name.
 * @returns <string> - the local project (e.g., dist/) directory name.
 */
export const getLocalDirname = (): string => {
  const filename = fileURLToPath(import.meta.url)
  return path.dirname(filename)
}

/**
 * Get a local file at a given path.
 * @param filePath <string>
 * @returns <any>
 */
export const getLocalFilePath = (filePath: string): any => path.join(getLocalDirname(), filePath)

/**
 * Read a local .json file at a given path.
 * @param filePath <string>
 * @returns <any>
 */
export const readLocalJsonFile = (filePath: string): any => readJSONFile(path.join(getLocalDirname(), filePath))

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

  if (!response.ok) showError(GENERIC_ERRORS.GENERIC_ERROR_RETRIEVING_DATA, true)

  if (response.body) await streamPipeline(response.body, createWriteStream(dest))
}
