import { initializeFirebaseCoreServices } from "@zkmpc/actions"
import figlet from "figlet"
import { FirebaseServices } from "packages/actions/types"
import clear from "clear"
import { showError, CONFIG_ERRORS } from "./errors"
import theme from "./theme"

/**
 * Bootstrap whatever is needed for a new command execution and related services.
 * @returns <Promise<FirebaseServices>>
 */
export const bootstrapCommandExecutionAndServices = async (): Promise<FirebaseServices> => {
    // Clean terminal window.
    clear()

    // Print header.
    console.log(theme.colors.magenta(figlet.textSync("Phase 2 cli", { font: "Ogre" })))

    // Check configs.
    if (!process.env.GITHUB_CLIENT_ID) showError(CONFIG_ERRORS.CONFIG_GITHUB_ERROR, true)
    if (
        !process.env.FIREBASE_API_KEY ||
        !process.env.FIREBASE_AUTH_DOMAIN ||
        !process.env.FIREBASE_PROJECT_ID ||
        !process.env.FIREBASE_MESSAGING_SENDER_ID ||
        !process.env.FIREBASE_APP_ID ||
        !process.env.FIREBASE_CF_URL_VERIFY_CONTRIBUTION
    )
        showError(CONFIG_ERRORS.CONFIG_FIREBASE_ERROR, true)
    if (
        !process.env.CONFIG_NODE_OPTION_MAX_OLD_SPACE_SIZE ||
        !process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB ||
        !process.env.CONFIG_CEREMONY_BUCKET_POSTFIX ||
        !process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS
    )
        showError(CONFIG_ERRORS.CONFIG_OTHER_ERROR, true)

    // Initialize and return Firebase services instances (App, Firestore, Functions)
    return initializeFirebaseCoreServices(
        process.env.FIREBASE_API_KEY,
        process.env.FIREBASE_AUTH_DOMAIN,
        process.env.FIREBASE_PROJECT_ID,
        process.env.FIREBASE_MESSAGING_SENDER_ID,
        process.env.FIREBASE_APP_ID
    )
}
