import fs, { Dirent, Stats } from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { GENERIC_ERRORS, showError } from "./errors"

/**
 * Check a directory path.
 * @param directoryPath <string> - the local path of the directory.
 * @returns <boolean> true if the directory at given path exists, otherwise false.
 */
export const directoryExists = (directoryPath: string): boolean => fs.existsSync(directoryPath)

/**
 * Write a new file locally.
 * @param localFilePath <string> - the local path of the file.
 * @param data <Buffer> - the content to be written inside the file.
 */
export const writeFile = (localFilePath: string, data: Buffer): void => fs.writeFileSync(localFilePath, data)

/**
 * Read a new file from local folder.
 * @param localFilePath <string> - the local path of the file.
 */
export const readFile = (localFilePath: string): string => fs.readFileSync(localFilePath, "utf-8")

/**
 * Get back the statistics of the provided file.
 * @param localFilePath <string> - the local path of the file.
 * @returns <Stats> - the metadata of the file.
 */
export const getFileStats = (localFilePath: string): Stats => fs.statSync(localFilePath)

/**
 * Return the sub-paths for each file stored in the given directory.
 * @param directoryLocalPath <string> - the local path of the directory.
 * @returns <Promise<Array<Dirent>>> - the list of sub-paths of the files contained inside the directory.
 */
export const getDirFilesSubPaths = async (directoryLocalPath: string): Promise<Array<Dirent>> => {
    // Get Dirent sub paths for folders and files.
    const subPaths = await fs.promises.readdir(directoryLocalPath, { withFileTypes: true })

    // Return Dirent sub paths for files only.
    return subPaths.filter((dirent: Dirent) => dirent.isFile())
}

/**
 * Filter all files in a directory by returning only those that match the given extension.
 * @param directoryLocalPath <string> - the local path of the directory.
 * @param fileExtension <string> - the file extension.
 * @returns <Promise<Array<Dirent>>> - return the filenames of the file that match the given extension, if any
 */
export const filterDirectoryFilesByExtension = async (
    directoryLocalPath: string,
    fileExtension: string
): Promise<Array<Dirent>> => {
    // Get the sub paths for each file stored in the given directory.
    const cwdFiles = await getDirFilesSubPaths(directoryLocalPath)
    // Filter by extension.
    return cwdFiles.filter((file: Dirent) => file.name.includes(fileExtension))
}

/**
 * Delete a directory specified at a given path.
 * @param directoryLocalPath <string> - the local path of the directory.
 */
export const deleteDir = (directoryLocalPath: string): void => {
    fs.rmSync(directoryLocalPath, { recursive: true, force: true })
}

/**
 * Clean a directory specified at a given path.
 * @param directoryLocalPath <string> - the local path of the directory.
 */
export const cleanDir = (directoryLocalPath: string): void => {
    deleteDir(directoryLocalPath)
    fs.mkdirSync(directoryLocalPath)
}

/**
 * Create a new directory in a specified path if not exist in that path.
 * @param directoryLocalPath <string> - the local path of the directory.
 */
export const checkAndMakeNewDirectoryIfNonexistent = (directoryLocalPath: string): void => {
    if (!directoryExists(directoryLocalPath)) fs.mkdirSync(directoryLocalPath)
}

/**
 * Read and return an object of a local JSON file located at a specific path.
 * @param filePath <string> - the path of the file.
 * @returns <any> - the content of the JSON file.
 */
export const readJSONFile = (filePath: string): any => {
    if (!directoryExists(filePath)) showError(GENERIC_ERRORS.GENERIC_FILE_NOT_FOUND_ERROR, true)

    return JSON.parse(readFile(filePath))
}

/**
 * Write data a local JSON file at a given path.
 * @param localFilePath <string> - the local path of the file.
 * @param data <JSON> - the JSON content to be written inside the file.
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
 * @param filePath <string> - the path of the file.
 * @returns <string> - the local file path.
 */
export const getLocalFilePath = (filePath: string): string => path.join(getLocalDirname(), filePath)

/**
 * Read a local JSON file at a given path.
 * @param filePath <string> - the path of the file.
 * @returns <any> - the data of the JSON file.
 */
export const readLocalJsonFile = (filePath: string): any => readJSONFile(path.join(getLocalDirname(), filePath))
