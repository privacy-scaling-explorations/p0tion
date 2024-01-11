import { Identity } from "@semaphore-protocol/identity"

import { commonTerms } from "@p0tion/actions"
import { httpsCallable } from "firebase/functions"
import { groth16 } from "snarkjs"
import path from "path"
import { bootstrapCommandExecutionAndServices } from "../lib/services.js"
import { addMemberToGroup, isGroupMember } from "../lib/bandada.js"
import { checkLocalBandadaIdentity, getLocalBandadaIdentity, setLocalBandadaIdentity } from "../lib/localConfigs.js"

const { BANDADA_DASHBOARD_URL, BANDADA_GROUP_ID } = process.env

const authBandada = async () => {
    // 1. check if _identity string exists in local storage
    let identityString: string | unknown
    const isIdentityStringStored = checkLocalBandadaIdentity()
    if (isIdentityStringStored) {
        identityString = getLocalBandadaIdentity()
    } else {
        // 2. generate a random _identity string and save it in local storage
        identityString = "random string"
        setLocalBandadaIdentity(identityString as string)
    }
    // 3. create a semaphore identity with _identity string as a seed
    const identity = new Identity(identityString as string)
    const isMember = await isGroupMember(BANDADA_GROUP_ID, identity)
    if (!isMember) {
        await addMemberToGroup(BANDADA_GROUP_ID, BANDADA_DASHBOARD_URL, identity)
    }
    // 4. generate a proof that the user owns the commitment.
    // publicSignals = [hash(externalNullifier, identityNullifier), commitment]
    const { proof, publicSignals } = await groth16.fullProve(
        {
            identityTrapdoor: identity.trapdoor,
            identityNullifier: identity.nullifier,
            externalNullifier: BANDADA_GROUP_ID
        },
        path.join(path.resolve(), "/public/mini-semaphore.wasm"),
        path.join(path.resolve(), "/public/mini-semaphore.zkey")
    )
    // 5. send proof to a cloud function that verifies it and checks membership
    const { firebaseFunctions } = await bootstrapCommandExecutionAndServices()
    const cf = httpsCallable(firebaseFunctions, commonTerms.cloudFunctionsNames.bandadaValidateProof)
    const result = await cf({
        proof,
        publicSignals
    })
    const [valid, message] = result.data as [boolean, string]
    console.log(valid)
    console.log(message)
    // 6. TODO: Auth to p0tion

    process.exit(0)
}

export default authBandada
