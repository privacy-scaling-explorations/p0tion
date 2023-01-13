import { initializeFirebaseCoreServices } from "@zkmpc/actions"
import figlet from "figlet"
import { FirebaseServices } from "packages/actions/types"
import clear from "clear"
import { theme } from "./constants"
import { showError, GITHUB_ERRORS, FIREBASE_ERRORS } from "./errors"

/**
 * Bootstrap whatever is needed for a new command execution and related services.
 * @returns <Promise<FirebaseServices>>
 */
export const bootstrapCommandExecutionAndServices = async (): Promise<FirebaseServices> => {
    // Clean terminal window.
    clear()

    // Print header.
    console.log(theme.magenta(figlet.textSync("Phase 2 cli", { font: "Ogre" })))

    // Check configs.
    if (!process.env.GITHUB_CLIENT_ID) showError(GITHUB_ERRORS.GITHUB_NOT_CONFIGURED_PROPERLY, true)
    if (
        !process.env.FIREBASE_API_KEY ||
        !process.env.FIREBASE_AUTH_DOMAIN ||
        !process.env.FIREBASE_PROJECT_ID ||
        !process.env.FIREBASE_MESSAGING_SENDER_ID ||
        !process.env.FIREBASE_APP_ID ||
        !process.env.FIREBASE_CF_URL_VERIFY_CONTRIBUTION
    )
        showError(FIREBASE_ERRORS.FIREBASE_NOT_CONFIGURED_PROPERLY, true)

    // Initialize and return Firebase services instances (App, Firestore, Functions)
    return initializeFirebaseCoreServices(
        process.env.FIREBASE_API_KEY,
        process.env.FIREBASE_AUTH_DOMAIN,
        process.env.FIREBASE_PROJECT_ID,
        process.env.FIREBASE_MESSAGING_SENDER_ID,
        process.env.FIREBASE_APP_ID
    )
}
