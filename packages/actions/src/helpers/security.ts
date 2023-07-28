import fetch from "@adobe/node-fetch-retry"
/**
 * This function will return the number of public repos of a user
 * @param user <string> The username of the user
 * @returns <number> The number of public repos
 */
const getNumberOfPublicReposGitHub = async (user: string): Promise<number> => {
    const response = await fetch(`https://api.github.com/user/${user}/repos`, {
        method: "GET",
        headers: {
            Authorization: `token ${process.env.GITHUB_ACCESS_TOKEN!}`
        }
    })
    if (response.status !== 200)
        throw new Error("It was not possible to retrieve the number of public repositories. Please try again.")
    const jsonData: any = await response.json()
    return jsonData.length
}
/**
 * This function will return the number of followers of a user
 * @param user <string> The username of the user
 * @returns <number> The number of followers
 */
const getNumberOfFollowersGitHub = async (user: string): Promise<number> => {
    const response = await fetch(`https://api.github.com/user/${user}/followers`, {
        method: "GET",
        headers: {
            Authorization: `token ${process.env.GITHUB_ACCESS_TOKEN!}`
        }
    })
    if (response.status !== 200)
        throw new Error("It was not possible to retrieve the number of followers. Please try again.")
    const jsonData: any = await response.json()
    return jsonData.length
}
/**
 * This function will return the number of following of a user
 * @param user <string> The username of the user
 * @returns <number> The number of following users
 */
const getNumberOfFollowingGitHub = async (user: string): Promise<number> => {
    const response = await fetch(`https://api.github.com/user/${user}/following`, {
        method: "GET",
        headers: {
            Authorization: `token ${process.env.GITHUB_ACCESS_TOKEN!}`
        }
    })

    if (response.status !== 200)
        throw new Error("It was not possible to retrieve the number of following. Please try again.")

    const jsonData: any = await response.json()

    return jsonData.length
}

/**
 * This function will check if the user is reputable enough to be able to use the app
 * @param userLogin <string> The username of the user
 * @param minimumAmountOfFollowing <number> The minimum amount of following the user should have
 * @param minimumAmountOfFollowers <number> The minimum amount of followers the user should have
 * @param minimumAmountOfPublicRepos <number> The minimum amount of public repos the user should have
 * @returns <boolean> True if the user is reputable enough, false otherwise
 */
export const githubReputation = async (
    userLogin: string,
    minimumAmountOfFollowing: number,
    minimumAmountOfFollowers: number,
    minimumAmountOfPublicRepos: number
): Promise<boolean> => {
    if (!process.env.GITHUB_ACCESS_TOKEN)
        throw new Error(
            "The GitHub access token is missing. Please insert a valid token to be used for anti-sybil checks on user registation, and then try again."
        )
    const following = await getNumberOfFollowingGitHub(userLogin)
    const repos = await getNumberOfPublicReposGitHub(userLogin)
    const followers = await getNumberOfFollowersGitHub(userLogin)

    if (
        following < minimumAmountOfFollowing ||
        repos < minimumAmountOfPublicRepos ||
        followers < minimumAmountOfFollowers
    )
        return false
    return true
}
