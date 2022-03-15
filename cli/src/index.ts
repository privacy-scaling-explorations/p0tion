import clear from "clear"
import figlet from "figlet"
import CLI from "clui"
import inquirer from "inquirer"
import { initializeApp, getApps } from "firebase/app"
import dotenv from "dotenv"
import theme from "./lib/theme.js"

dotenv.config()
clear()
const run = async () => {
  console.log(theme.title(figlet.textSync("MPC Phase 2 Suite", { horizontalLayout: "full" })))
  console.log(
    theme.subtitle(
      figlet.textSync("MACI v1.x", {
        font: "Small",
        horizontalLayout: "full"
      })
    )
  )

  // Firebase app init.
  if (getApps().length === 0) {
    const app = initializeApp({
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID
    })
    console.log(theme.ok(`Firebase ${app.name} app correctly configured!\n`))

    console.log("Are you ready for MACI v1.x Phase 2 Trusted Setup Ceremony?")

    const response = await inquirer.prompt({
      name: "qst",
      type: "confirm",
      message: "You should wait ⏰ Do you want to?"
    })

    if (response.qst) console.log(theme.ok("Good!"))
    else console.log(theme.error("Bad!!!"))

    const countdown = new CLI.Spinner("Exiting in 3 seconds...  ", ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"])
    countdown.start()

    let number = 3
    setInterval(() => {
      number -= 1
      countdown.message(`Exiting in ${number} seconds...  `)
      if (number === 0) {
        process.exit(0)
      }
    }, 1000)
  } else {
    console.log(theme.error("Something went wrong when configuring Firebase!"))
  }
}

run()
