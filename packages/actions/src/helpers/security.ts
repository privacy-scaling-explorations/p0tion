import fetch from "@adobe/node-fetch-retry"
import { ethers } from "ethers"
import { ApiSdk } from "@bandada/api-sdk"
import { Groth16Proof, PublicSignals, groth16 } from "snarkjs"

let internalProvider: ethers.providers.Provider

type ReputationResponse = {
    reputable: boolean
    avatarUrl?: string
    message?: string
}

/**
 * This function queries the GitHub API to fetch users statistics
 * @param user {string} the user uid
 * @returns {any} the stats from the GitHub API
 */
const getGitHubStats = async (user: string): Promise<any> => {
    const response = await fetch(`https://api.github.com/users/${user}`, {
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
        avatarUrl: jsonData.avatar_url,
        age: jsonData.created_at
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
    minimumAmountOfPublicRepos: number,
    minimumAge: number
): Promise<ReputationResponse> => {
    if (!process.env.GITHUB_ACCESS_TOKEN)
        throw new Error(
            "The GitHub access token is missing. Please insert a valid token to be used for anti-sybil checks on user registation, and then try again."
        )

    const { following, followers, publicRepos, avatarUrl, age } = await getGitHubStats(userLogin)

    if (
        following < minimumAmountOfFollowing ||
        publicRepos < minimumAmountOfPublicRepos ||
        followers < minimumAmountOfFollowers ||
        new Date(age) > new Date(Date.now() - minimumAge)
    )
        return {
            reputable: false,
            avatarUrl: ""
        }

    return {
        reputable: true,
        avatarUrl
    }
}

/**
 * Returns a Prvider, connected via a configured JSON URL or else
 * the ethers.js default provider, using configured API keys.
 * @returns <ethers.providers.Provider> An Eth node provider
 */
export const setEthProvider = (chainName: string): ethers.providers.Provider => {
    if (internalProvider) return internalProvider
    console.log(`setting new provider`)

    // Use JSON URL if defined
    // if ((hardhat as any).ethers) {
    //     console.log(`using hardhat.ethers provider`)
    //     provider = (hardhat as any).ethers.provider
    // } else
    if (process.env.ETH_PROVIDER_JSON_URL) {
        console.log(`JSON URL provider at ${process.env.ETH_PROVIDER_JSON_URL}`)
        internalProvider = new ethers.providers.JsonRpcProvider(
            {
                url: process.env.ETH_PROVIDER_JSON_URL,
                skipFetchSetup: true
            },
            chainName
        )
    } else {
        // Otherwise, connect the default provider with ALchemy, Infura, or both
        internalProvider = ethers.providers.getDefaultProvider(chainName, {
            alchemy: process.env.ETH_PROVIDER_ALCHEMY_API_KEY!,
            infura: process.env.ETH_PROVIDER_INFURA_API_KEY!
        })
    }
    return internalProvider
}

export const siweReputation = async (
    userAddress: string,
    minimumNonce: number,
    blockHeight: number,
    chainName: string
): Promise<ReputationResponse> => {
    // look up nonce for address @block
    let nonceOk = true
    if (minimumNonce > 0) {
        const provider = setEthProvider(chainName)
        console.log(`got provider - block # ${await provider.getBlockNumber()}`)
        const nonce = await provider.getTransactionCount(userAddress, blockHeight)
        console.log(`nonce: ${nonce}`)
        nonceOk = nonce >= minimumNonce
    }
    if (!nonceOk) {
        return {
            reputable: false,
            message: "Eth address does not meet the nonce requirements"
        }
    }
    return {
        reputable: true
    }
}

export const bandadaReputation = async (
    commitment: string,
    proof: Groth16Proof,
    publicSignals: PublicSignals,
    groupId: string
): Promise<ReputationResponse> => {
    const bandadaApi = new ApiSdk(process.env.BANDADA_API_URL)
    const VKEY_DATA = JSON.parse(process.env.BANDADA_VKEY_DATA!)

    const isCorrect = groth16.verify(VKEY_DATA, publicSignals, proof)
    if (!isCorrect) {
        return {
            reputable: false,
            message: "Invalid proof"
        }
    }
    const isMember = await bandadaApi.isGroupMember(groupId, commitment)
    if (!isMember) {
        return {
            reputable: false,
            message: "Not a member of the group"
        }
    }
    return {
        reputable: true
    }
}
