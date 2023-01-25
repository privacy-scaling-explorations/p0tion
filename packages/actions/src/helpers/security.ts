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
            Authorization: `token ${token}`
        }
    })
    const repos = await response.json()

    if (!repos || repos.length === 0) throw new Error("No public repos found")
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
    if (userResponse.status !== 200) throw new Error("Not connected")
    const user = await userResponse.json()

    const following = Number(user.following)
    const repos = await getNumberOfPublicRepos(user.login, token)

    if (following < 5 || repos === 0) throw new Error("This account is not reputable enough")
}
