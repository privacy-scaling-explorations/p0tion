import { CircuitDocument, SetupCeremonyData } from "@p0tion/actions"
import { showError } from "../lib/errors.js"

export const createCeremony = async (ceremonySetupData: SetupCeremonyData) => {
    try {
        const result = (await fetch(`${process.env.API_URL}/ceremony/create`, {
            method: "POST",
            body: JSON.stringify({
                ...ceremonySetupData.ceremonyInputData,
                prefix: ceremonySetupData.ceremonyPrefix,
                state: "SCHEDULED",
                type: "PHASE2",
                authProviders: ["github"],
                github: {
                    minimumFollowing: 1,
                    minimumFollowers: 1,
                    minimumPublicRepos: 1,
                    minimumAge: 1652670409
                }
            })
        }).then((res) => res.json())) as { id: number }
        return result
    } catch (error: any) {
        const errorBody = JSON.parse(JSON.stringify(error))
        showError(`[${errorBody.code}] ${error.message} ${!errorBody.details ? "" : `\n${errorBody.details}`}`, true)
        return { id: -1 }
    }
}

export const createBucket = async (ceremonyId: number) => {
    try {
        const url = new URL(`${process.env.API_URL}/storage/create-bucket`)
        url.search = new URLSearchParams({ ceremonyId: ceremonyId.toString() }).toString()
        const result = (await fetch(url.toString(), {
            method: "GET"
        }).then((res) => res.json())) as { bucketName: string }
        return result
    } catch (error: any) {
        const errorBody = JSON.parse(JSON.stringify(error))
        showError(`[${errorBody.code}] ${error.message} ${!errorBody.details ? "" : `\n${errorBody.details}`}`, true)
        return { bucketName: "" }
    }
}

export const createCircuits = async (ceremonyId: number, circuitsSetupData: CircuitDocument[]) => {
    try {
        const url = new URL(`${process.env.API_URL}/ceremonies/create-circuits`)
        url.search = new URLSearchParams({ ceremonyId: ceremonyId.toString() }).toString()
        const result = await fetch(url.toString(), {
            method: "POST",
            body: JSON.stringify({
                circuits: circuitsSetupData
            })
        }).then((res) => res.json())
        console.log(result)
        return result
    } catch (error) {
        const errorBody = JSON.parse(JSON.stringify(error))
        showError(`[${errorBody.code}] ${error.message} ${!errorBody.details ? "" : `\n${errorBody.details}`}`, true)
        return {}
    }
}
