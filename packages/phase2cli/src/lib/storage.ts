import { Functions } from "firebase/functions"
import fetch from "@adobe/node-fetch-retry"
import { createWriteStream } from "node:fs"
import dotenv from "dotenv"
import { SingleBar, Presets } from "cli-progress"
import { generateGetObjectPreSignedUrl, convertToGB } from "@zkmpc/actions"
import { ProgressBarType } from "../../types/index"
import { GENERIC_ERRORS, showError } from "./errors"
import { emojis, theme } from "./constants"

dotenv.config()

/**
 * Return a custom progress bar.
 * @param type <ProgressBarType> - the type of the progress bar.
 * @returns <SingleBar> - a new custom (single) progress bar.
 */
export const customProgressBar = (type: ProgressBarType): SingleBar => {
    // Formats.
    const uploadFormat = `${emojis.arrowUp}  Uploading [${theme.magenta(
        "{bar}"
    )}] {percentage}% | {value}/{total} Chunks`
    const downloadFormat = `${emojis.arrowDown}  Downloading [${theme.magenta(
        "{bar}"
    )}] {percentage}% | {value}/{total} GB`

    // Define a progress bar showing percentage of completion and chunks downloaded/uploaded.
    return new SingleBar(
        {
            format: type === ProgressBarType.DOWNLOAD ? downloadFormat : uploadFormat,
            hideCursor: true,
            clearOnComplete: true
        },
        Presets.legacy
    )
}

/**
 * Download locally a specified file from the given bucket.
 * @param firebaseFunctions <Functions> - the firebase cloud functions.
 * @param bucketName <string> - the name of the AWS S3 bucket.
 * @param objectKey <string> - the identifier of the object (storage path).
 * @param localPath <string> - the path where the file will be written.
 * @return <Promise<void>>
 */
export const downloadLocalFileFromBucket = async (
    firebaseFunctions: Functions,
    bucketName: string,
    objectKey: string,
    localPath: string
): Promise<void> => {
    // Call generateGetObjectPreSignedUrl() Cloud Function.
    const preSignedUrl = await generateGetObjectPreSignedUrl(firebaseFunctions, bucketName, objectKey)

    // Get request.
    const getResponse = await fetch(preSignedUrl)
    if (!getResponse.ok) showError(`${GENERIC_ERRORS.GENERIC_FILE_ERROR} - ${getResponse.statusText}`, true)

    const contentLength = Number(getResponse.headers.get(`content-length`))
    const contentLengthInGB = convertToGB(contentLength, true)

    // Create a new write stream.
    const writeStream = createWriteStream(localPath)

    // Define a custom progress bar starting from last updated chunk.
    const progressBar = customProgressBar(ProgressBarType.DOWNLOAD)

    // Progress bar step size.
    const progressBarStepSize = contentLengthInGB / 100

    let writtenData = 0
    let nextStepSize = progressBarStepSize

    // Init the progress bar.
    progressBar.start(contentLengthInGB < 0.01 ? 0.01 : Number(contentLengthInGB.toFixed(2)), 0)

    // Write chunk by chunk.
    for await (const chunk of getResponse.body) {
        // Write.
        writeStream.write(chunk)

        // Update.
        writtenData += chunk.length

        // Check if the progress bar must advance.
        while (convertToGB(writtenData, true) >= nextStepSize) {
            // Update.
            nextStepSize += progressBarStepSize

            // Increment bar.
            progressBar.update(contentLengthInGB < 0.01 ? 0.01 : parseFloat(nextStepSize.toFixed(2)).valueOf())
        }
    }

    progressBar.stop()
}
