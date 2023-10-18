import fetch from "@adobe/node-fetch-retry"
/**
 * This function queries the GitHub API to fetch users statistics
 * @param user {string} the user uid
 * @returns {any} the stats from the GitHub API
 */
const getGitHubStats = async (user: string): Promise<any> => {
    const response = await fetch(`https://api.github.com/user/${user}`, {
        method: "GET",
        headers: {
            Authorization: `token ${process.env.GITHUB_ACCESS_TOKEN!}`
        }
    })
    if (response.status !== 200)
        throw new Error("It was not possible to retrieve the user's statistic. Please try again.")

    const jsonData: any = await response.json()

    const data = {
        following: jsonData.following,
        followers: jsonData.followers,
        publicRepos: jsonData.public_repos,
        avatarUrl: jsonData.avatar_url
    }

    return data
}

/**
 * This function will check if the user is reputable enough to be able to use the app
 * @param userLogin <string> The username of the user
 * @param minimumAmountOfFollowing <number> The minimum amount of following the user should have
 * @param minimumAmountOfFollowers <number> The minimum amount of followers the user should have
 * @param minimumAmountOfPublicRepos <number> The minimum amount of public repos the user should have
 * @returns <any> Return the avatar URL of the user if the user is reputable, false otherwise
 */
export const githubReputation = async (
    userLogin: string,
    minimumAmountOfFollowing: number,
    minimumAmountOfFollowers: number,
    minimumAmountOfPublicRepos: number
): Promise<any> => {
    if (!process.env.GITHUB_ACCESS_TOKEN)
        throw new Error(
            "The GitHub access token is missing. Please insert a valid token to be used for anti-sybil checks on user registation, and then try again."
        )

    const { following, followers, publicRepos, avatarUrl } = await getGitHubStats(userLogin)

    if (
        following < minimumAmountOfFollowing ||
        publicRepos < minimumAmountOfPublicRepos ||
        followers < minimumAmountOfFollowers
    )
        return {
            reputable: false,
            avatarUrl: ""
        }

    return {
        reputable: true,
        avatarUrl: avatarUrl
    }
}
