import { SetupCeremonyData } from "packages/actions/src/types"
import { showError } from "../lib/errors"

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
        const result = (await fetch(`${process.env.API_URL}/storage/create-bucket`, {
            method: "GET"
        }).then((res) => res.json())) as { bucketName: string }
        return result
    } catch (error: any) {
        const errorBody = JSON.parse(JSON.stringify(error))
        showError(`[${errorBody.code}] ${error.message} ${!errorBody.details ? "" : `\n${errorBody.details}`}`, true)
        return { bucketName: "" }
    }
}

export const createCircuits = () => {}
