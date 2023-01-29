import fetch from "node-fetch"

/**
 * This function will return the number of public repos of a user
 * @param user <string> The username of the user
 * @param token <string> The token of the user
 * @returns <number> The number of public repos
 */
const getNumberOfPublicReposGitHub = async (user: string, token: string): Promise<number> => {
    const response = await fetch(`https://api.github.com/users/${user}/repos`, {
        headers: {
            authorization: `token ${token}`
        }
    })
    if (response.status !== 200)
        throw new Error("It was not possible to retrieve the number of public repositories. Please try again.")

    return (await response.json()).length
}

/**
 * This function will return the number of followers of a user
 * @param user <string> The username of the user
 * @param token <string> The token of the user
 * @returns <number> The number of followers
 */
const getNumberOfFollowersGitHub = async (user: string, token: string): Promise<number> => {
    const response = await fetch(`https://api.github.com/users/${user}/followers`, {
        headers: {
            authorization: `token ${token}`
        }
    })

    if (response.status !== 200)
        throw new Error("It was not possible to retrieve the number of followers. Please try again.")

    return (await response.json()).length
}

/**
 * This function will check if the user is reputable enough to be able to use the app
 * @param token <string> The token of the user
 * @param minimumAmountOfFollowing <number> The minimum amount of following the user should have
 * @param minimumAmountOfPublicRepos <number> The minimum amount of public repos the user should have
 * @param minimumAmountOfFollowers <number> The minimum amount of followers the user should have
 */
export const githubReputation = async (
    token: string,
    minimumAmountOfFollowing: number,
    minimumAmountOfPublicRepos: number,
    minimumAmountOfFollowers: number
) => {
    const userResponse = await fetch("https://api.github.com/user", {
        headers: {
            authorization: `token ${token}`
        }
    })
    if (userResponse.status !== 200)
        throw new Error("The token is not valid. Please authenticate via GitHub and try again.")
    const user = await userResponse.json()

    const following = Number(user.following)
    const repos = await getNumberOfPublicReposGitHub(user.login, token)
    const followers = await getNumberOfFollowersGitHub(user.login, token)

    if (
        following < minimumAmountOfFollowing ||
        repos < minimumAmountOfPublicRepos ||
        followers < minimumAmountOfFollowers
    )
        throw new Error(
            `The user connected does not fit the anti-spam criteria.` +
                `Please connect with an account that follows at least ${minimumAmountOfFollowing} users, ` +
                `has at least ${minimumAmountOfPublicRepos} public repositories and has at least ${minimumAmountOfFollowers} followers.`
        )
}
