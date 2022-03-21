import inquirer from "inquirer"
import logSymbols from "log-symbols"
import Configstore from "configstore"
import { handleCLILogin } from "./cli.js"
import theme from "./theme.js"

/**
 * Prompt a confirmation for OAuth completion.
 * @returns <Promise<boolean>>
 */
export const promptOAuthConfirmation = async (): Promise<boolean> => {
  process.stdout.write("\n")

  const response = await inquirer.prompt([
    {
      type: "confirm",
      message: theme.violetD("Step 3 - Everything went well? 🌈 "),
      name: "isOAuthComplete"
    }
  ])

  return response.isOAuthComplete
}

/**
 * Prompt some help options for the user in case something goes wrong.
 * @returns <Promise<any>>
 */
export const promptHelpOAuthMenu = async (): Promise<any> => {
  process.stdout.write("\n")

  const choice1 = "I need to generate another code since it has expired 😴 "
  const choice2 = "I got a server/timeout error from Github 😵 "
  const choice3 = "The authorization request was denied 😠 "
  const choice4 = "I'm tired, I want to get out 😥 "

  const response = await inquirer.prompt([
    {
      type: "list",
      message: theme.blueD("What can we help you with? 🧐 "),
      name: "oAuthHelpChoice",
      choices: [choice1, choice2, choice3, choice4]
    }
  ])

  if (response.oAuthHelpChoice === choice1) {
    console.log(theme.yellowD(`\nGithub OAuth 2.0 steps correctly restarted ${logSymbols.success}`))
    return handleCLILogin(process.env.GITHUB_CLIENT_ID!)
  }

  if (response.oAuthHelpChoice === choice2) {
    console.log(
      theme.yellowD(
        `\n ${logSymbols.warning} This error depends on the Github servers and there is nothing we can do about it except wait. Sorry, please try again later.`
      )
    )
    console.log(
      theme.monoD(
        `\n ${logSymbols.info} You can check for errors at this link ${theme.underlined(
          theme.bold("https://www.githubstatus.com/")
        )}.`
      )
    )
    return process.exit(1)
  }

  if (response.oAuthHelpChoice === choice3) {
    console.log(theme.yellowD(`\n ${logSymbols.warning} Looks like this Github account has been disabled`))
    console.log(
      theme.monoD(
        `\n ${logSymbols.info} Please reach out to the ${theme.underlined(
          theme.bold("coordinator")
        )} to find out the reason.`
      )
    )

    return process.exit(1)
  }

  console.log(theme.purpleD(`\n We're sorry, you broke our hearts 💔 If you'd like to retry, we're still here.`))

  return process.exit(0)
}

/**
 * Prompt the after login menu.
 * @param configStore <Configstore> - the local config storage.
 * @param username <string> - the Github username.
 * @returns <Promise<any>>
 */
export const promptForAfterLoginMenu = async (configStore: Configstore, username: string): Promise<any> => {
  process.stdout.write("\n")
  // Choices.
  const choice1 = "Join the queue to contribute!"
  const choice2 = "Change the Github account"
  const choice3 = "Leaving!"

  // Prepare inquirer question.
  const response = await inquirer.prompt([
    {
      type: "list",
      message: theme.monoD(`Greetings ${theme.acquaD(username)}! What would you like to do?`),
      name: "mainMenu",
      choices: [choice1, choice2, choice3]
    }
  ])

  if (response.mainMenu === choice1) {
    console.log("\nWork in progress...")
    return process.exit(0)
  }

  if (response.mainMenu === choice2) {
    console.log(
      `\n ${logSymbols.warning} To change your Github account you will need to repeat the authentication process with OAuth 2.0!`
    )
    console.log(
      theme.monoD(
        theme.italic(` ${logSymbols.info} This operation will ${theme.bold(
          theme.underlined("not")
        )} disassociate your account from the OAuth application.
    You can do this by navigating ${theme.bold("Settings -> Applications -> Authorized OAuth Apps")}. 
    Also, to getting rid of all traces left into Firebase, please contact the ${theme.bold("Coordinator")}!\n`)
      )
    )

    const response = await inquirer.prompt([
      {
        type: "confirm",
        message: "You sure you want to repeat the OAuth process?",
        name: "wannaRepeat"
      }
    ])

    if (response.wannaRepeat) {
      // Storage clean.
      configStore.delete(process.env.CLI_CONFIG_STORE_GITHUB_AUTH_TOKEN_KEY!)

      console.log(theme.monoD(`\n ${logSymbols.success} Local storage cleaned 🌬 `))
      console.log(
        theme.monoD(
          `\n ${logSymbols.info} Please, restart the CLI to repeat the OAuth 2.0 process with a different Github account.`
        )
      )

      process.exit(0)
    }

    return promptForAfterLoginMenu(configStore, username)
  }

  console.log(theme.monoD(theme.bold(`\n See you soon 👋 `)))
  return process.exit(0)
}
