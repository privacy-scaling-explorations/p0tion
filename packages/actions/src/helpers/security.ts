import fetch from "node-fetch"

/**
 * This function will return the number of public repos of a user
 * @param user <string> The username of the user
 * @param token <string> The token of the user
 * @returns <number> The number of public repos
 */
const getNumberOfPublicRepos = async (user: string, token: string): Promise<number> => {
    const response = await fetch(`https://api.github.com/users/${user}/repos`, {
        headers: {
            authorization: `token ${token}`
        }
    })
    const repos = await response.json()

    if (!repos || repos.length === 0)
        throw new Error("It was not possible to retrieve the number of public repositories. Please try again.")
    return repos.length
}

/**
 * This function will check if the user is reputable enough to be able to use the app
 * @param token <string> The token of the user
 */
export const githubReputation = async (token: string) => {
    const userResponse = await fetch("https://api.github.com/user", {
        headers: {
            authorization: `token ${token}`
        }
    })
    if (userResponse.status !== 200)
        throw new Error("The token is not valid. Please authenticate via GitHub and try again.")
    const user = await userResponse.json()

    const following = Number(user.following)
    const repos = await getNumberOfPublicRepos(user.login, token)

    if (following < 5 || repos === 0)
        throw new Error(
            "The user connected does not fit the anti-spam criteria. Please connect with an account that follows at least five users and has at least one public repository"
        )
}
