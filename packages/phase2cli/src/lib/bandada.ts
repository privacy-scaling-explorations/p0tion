import { ApiSdk, GroupResponse } from "@bandada/api-sdk"
import { Identity } from "@semaphore-protocol/identity"
import open from "open"

import { askForConfirmation } from "../lib/prompts.js"
import { showError } from "./errors.js"
import theme from "../lib/theme.js"

const { BANDADA_API_URL } = process.env

const bandadaApi = new ApiSdk(BANDADA_API_URL)

export const getGroup = async (groupId: string): Promise<GroupResponse | null> => {
    try {
        const group = await bandadaApi.getGroup(groupId)
        return group
    } catch (error: any) {
        showError(`Bandada getGroup error: ${error}`, true)
        return null
    }
}

export const getMembersOfGroup = async (groupId: string): Promise<string[] | null> => {
    try {
        const group = await bandadaApi.getGroup(groupId)
        return group.members
    } catch (error: any) {
        showError(`Bandada getMembersOfGroup error: ${error}`, true)
        return null
    }
}

export const addMemberToGroup = async (groupId: string, dashboardUrl: string, identity: Identity) => {
    const commitment = identity.commitment.toString()
    const group = await bandadaApi.getGroup(groupId)
    const providerName = group.credentials.id.split("_")[0].toLowerCase()

    // 6. open a new window with the url:
    const url = `${dashboardUrl}credentials?group=${groupId}&member=${commitment}&provider=${providerName}`
    console.log(`${theme.text.bold(`Verification URL:`)} ${theme.text.underlined(url)}`)
    open(url)

    const { confirmation } = await askForConfirmation("Did you join the Bandada group in the browser?")
    if (!confirmation) showError("You must join the Bandada group to continue the login process", true)
}

export const isGroupMember = async (groupId: string, identity: Identity): Promise<boolean> => {
    const commitment = identity.commitment.toString()
    const isMember: boolean = await bandadaApi.isGroupMember(groupId, commitment)
    return isMember
}
