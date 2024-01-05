import dotenv from "dotenv"
import * as functions from "firebase-functions"
import { ApiSdk } from "@bandada/api-sdk"
import { verifyProof } from "@semaphore-protocol/proof"

import { BandadaValidateProof } from "../types/index"

dotenv.config()

const { BANDADA_API_URL, BANDADA_GROUP_ID } = process.env

const bandadaApi = new ApiSdk(BANDADA_API_URL)

export const bandadaValidateProof = functions
    .region("europe-west1")
    .runWith({
        memory: "512MB"
    })
    .https.onCall(async (data: BandadaValidateProof): Promise<boolean> => {
        if (!BANDADA_GROUP_ID) throw new Error("BANDADA_GROUP_ID is not defined in .env")
        const group = await bandadaApi.getGroup(BANDADA_GROUP_ID)
        // TODO: check merklet root? Why do we save them separately in Supabase?
        // TODO: check is nullifier was used
        const { merkleTreeRoot, nullifierHash, proof, signal } = data
        const isVerified = await verifyProof(
            {
                merkleTreeRoot,
                nullifierHash,
                externalNullifier: BANDADA_GROUP_ID,
                signal,
                proof
            },
            group.treeDepth
        )
        return isVerified
    })

export default bandadaValidateProof
