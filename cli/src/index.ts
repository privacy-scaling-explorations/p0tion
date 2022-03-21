import clear from "clear"
import figlet from "figlet"
import dotenv from "dotenv"
import { FirebaseApp } from "firebase/app"
import { Firestore } from "firebase/firestore"
import Configstore from "configstore"
import { User } from "firebase/auth"
import logSymbols from "log-symbols"
import { handleAfterLogin, handleCLILogin } from "./lib/cli.js"
import { initializeFirebaseApp, getFirestoreDatabase, signInToFirebaseWithGithubCredentials } from "./lib/firebase.js"
import theme from "./lib/theme.js"

dotenv.config()

/** Application state */
let firebaseApp: FirebaseApp
let firestoreDatabase: Firestore
let firebaseToken: string
let user: User
let configStore: Configstore

clear()

/** CLI Main */
const main = async () => {
  /** Header */
  console.log(
    theme.yellowD(
      figlet.textSync("MPC Phase2 Suite", {
        font: "Slant",
        horizontalLayout: "full",
        verticalLayout: "full",
        width: 360,
        whitespaceBreak: true
      })
    )
  )
  console.log(theme.purpleD(theme.bold("Welcome to the MACI v1.x Phase2 Trusted Setup ceremony 🚀 ")))
  console.log(
    theme.monoD(
      `\nThe ceremony run from ${theme.bold("Apr. 20")} to ${theme.bold(
        "Apr. 30"
      )}. To participate you need a ${theme.bold("Github")} account.
      \nContributions will be calculated ${theme.bold(
        "independently"
      )} for each individual configuration of each circuit. Wish you an happy contribution 🗝 `
    )
  )

  try {
    /** Check .env variables */
    // CLI.
    if (!process.env.CLI_CONFIG_STORE_NAME || !process.env.CLI_CONFIG_STORE_GITHUB_AUTH_TOKEN_KEY)
      throw new Error("Please, check that all CLI_ variables in the .env file are set correctly.")

    // Github.
    if (!process.env.GITHUB_CLIENT_ID)
      throw new Error("Please, check that all GITHUB_ variables in the .env file are set correctly.")

    // Firebase.
    if (
      !process.env.FIREBASE_API_KEY ||
      !process.env.FIREBASE_AUTH_DOMAIN ||
      !process.env.FIREBASE_PROJECT_ID ||
      !process.env.FIREBASE_STORAGE_BUCKET ||
      !process.env.FIREBASE_MESSAGING_SENDER_ID ||
      !process.env.FIREBASE_APP_ID ||
      !process.env.FIREBASE_FIRESTORE_DATABASE_URL
    )
      throw new Error("Please, check that all FIREBASE_ variables in the .env file are set correctly.")

    console.log(theme.monoD(`\n${logSymbols.success} CLI configuration 🛠 `))

    /** Initialization */
    configStore = new Configstore(process.env.CLI_CONFIG_STORE_NAME)
    firebaseToken = configStore.get(process.env.CLI_CONFIG_STORE_GITHUB_AUTH_TOKEN_KEY)

    firebaseApp = initializeFirebaseApp({
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
      databaseURL: process.env.FIREBASE_FIRESTORE_DATABASE_URL
    })
    firestoreDatabase = getFirestoreDatabase(firebaseApp)

    console.log(theme.monoD(`${logSymbols.success} Services initialization 🗄 `))
    console.log(`\t${logSymbols.success} ${firebaseApp.options.projectId}`)
    console.log(`\t${logSymbols.success} ${firestoreDatabase.type}`)

    // Check if the Github OAuth flow is needed (i.e., first time / refresh).
    if (!firebaseToken) {
      console.log(
        theme.yellowD(`\n${logSymbols.warning} You haven't yet linked your Github account with this CLI application!`)
      )
      console.log(
        theme.monoD(
          "We are going to use Github OAuth 2.0 (manual) Device Flow. Don't worry, we will make it all work in a few simple steps 🎡 "
        )
      )

      // Get the firebase token and store locally.
      firebaseToken = await handleCLILogin(process.env.GITHUB_CLIENT_ID!)

      console.log(theme.monoD(`You have successfully completed the steps. Congrats 🎇 `))
      console.log(theme.monoD(theme.underlined(`\nYour Firebase Token`), "↪ ", theme.acquaD(theme.bold(firebaseToken))))

      configStore.set(process.env.CLI_CONFIG_STORE_GITHUB_AUTH_TOKEN_KEY!, firebaseToken)
      console.log(theme.monoD(`\n${logSymbols.success} Firebase Token safely stored 🔒 `))
    } else console.log(theme.monoD("\nSeems that there is already a Firebase Token locally stored 👀 "))

    // Sign in to Firebase w/ Github and retrieve auth user info.
    user = (await signInToFirebaseWithGithubCredentials(firebaseToken)).user
    console.log(theme.monoD(`\n${logSymbols.success} Login successfully 🎊 `))

    // After login logic.
    await handleAfterLogin(user, configStore)

    process.exit(0)
  } catch (err: any) {
    // TODO: find a more graceful method to stop/exit for process.exit(1).
    // ref. https://nodejs.dev/learn/how-to-exit-from-a-nodejs-program.

    if (
      err
        .toString()
        .includes(
          "FirebaseError: Firebase: Firebase App named '[DEFAULT]' already exists with different options or config"
        )
    ) {
      console.log(
        theme.redD(
          `\n ${logSymbols.error} Oops, it would look like there are two configurations for the same Firebase app. Please check and try again.`
        )
      )
    }

    if (err.toString().includes("The authorization request is still pending.")) {
      console.log(
        theme.redD(
          `\n ${logSymbols.error} We're sorry, but Github replied that your authorization is still pending. Unfortunately, you will have to repeat the process by restarting the CLI.`
        )
      )
      console.log(
        theme.monoD(
          `\n ${logSymbols.info} Please, follow the steps on the Github page until it is confirmed that you have successfully associated the CLI with your account.`
        )
      )
    }

    if (err.toString().includes("Firebase: Unsuccessful check authorization response from Github")) {
      console.log(
        theme.redD(
          `\n ${logSymbols.error} Oops, probably your token has been expired or you have removed the Github association for your account with this CLI.`
        )
      )

      // Storage clean.
      configStore.delete(process.env.CLI_CONFIG_STORE_GITHUB_AUTH_TOKEN_KEY!)

      console.log(theme.monoD(`\n ${logSymbols.success} Local storage cleaned 🌬 `))
      console.log(theme.monoD(`\n ${logSymbols.info} Please, restart the CLI to repeat the OAuth 2.0 process.`))
    }

    if (err.toString().includes("Firebase: Error (auth/user-disabled)")) {
      console.log(
        theme.redD(`\n ${logSymbols.error} Oops, it would appear that your Github account has been disabled!`)
      )
      console.log(
        theme.monoD(`\n ${logSymbols.info} Please, ask the ${theme.monoD("Coordinator")} for more information.`)
      )
    }

    if (
      err
        .toString()
        .includes("Firebase: Remote site 5XX from github.com for VERIFY_CREDENTIAL (auth/invalid-credential)")
    ) {
      console.log(theme.redD(`\n ${logSymbols.error} Firebase can't verify your Github credentials!`))
      console.log(
        theme.monoD(
          `\n ${logSymbols.info} This typically happens due to a network error. Check your connection and try again.`
        )
      )
    }

    if (err.toString().includes("HttpError: The authorization request was denied")) {
      console.log(
        theme.redD(
          `\n ${logSymbols.error} Oops, it looks like you have refused to associate the CLI with your Github account.`
        )
      )
      console.log(
        theme.monoD(
          `\n ${logSymbols.info} You must confirm in order to participate in the ceremony. Please, restart the CLI to repeat the OAuth 2.0 process.`
        )
      )
    }

    if (
      err
        .toString()
        .includes("HttpError: request to https://github.com/login/device/code failed, reason: connect ETIMEDOUT")
    ) {
      console.log(theme.redD(`\n ${logSymbols.error} Oops, It appears that the Github server has timed out!`))
      console.log(
        theme.monoD(
          `\n ${logSymbols.info} This typically happens due to a network error or Github server downtime. Check your connection and try again.`
        )
      )
    }

    if (err.toString().includes("Please, check that all")) {
      console.log(theme.redD(`\n ${logSymbols.error} ${err.toString()}`))
    }

    process.exit(1)
  }
}

main()
