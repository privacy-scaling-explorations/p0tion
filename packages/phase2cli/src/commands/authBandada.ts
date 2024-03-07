import { Identity } from "@semaphore-protocol/identity"

import { commonTerms } from "@p0tion/actions"
import { httpsCallable } from "firebase/functions"
import { groth16 } from "snarkjs"
import { getAuth, signInWithCustomToken } from "firebase/auth"
import prompts from "prompts"
import { getLocalDirname } from "../lib/files.js"
import theme from "../lib/theme.js"
import { customSpinner } from "../lib/utils.js"
import { VerifiedBandadaResponse } from "../types/index.js"
import { showError } from "../lib/errors.js"
import { bootstrapCommandExecutionAndServices } from "../lib/services.js"
import { addMemberToGroup, isGroupMember } from "../lib/bandada.js"
import {
    checkLocalBandadaIdentity,
    deleteLocalAccessToken,
    deleteLocalBandadaIdentity,
    getLocalBandadaIdentity,
    setLocalAccessToken,
    setLocalBandadaIdentity
} from "../lib/localConfigs.js"

const { BANDADA_DASHBOARD_URL, BANDADA_GROUP_ID } = process.env

const authBandada = async () => {
    try {
        const { firebaseFunctions } = await bootstrapCommandExecutionAndServices()
        const spinner = customSpinner(`Checking identity string for Semaphore...`, `clock`)
        spinner.start()
        // 1. check if _identity string exists in local storage
        let identityString: string | unknown
        const isIdentityStringStored = checkLocalBandadaIdentity()
        if (isIdentityStringStored) {
            identityString = getLocalBandadaIdentity()
            spinner.succeed(`Identity seed found\n`)
        } else {
            spinner.warn(`Identity seed not found\n`)
            // 2. generate a random _identity string and save it in local storage
            const { seed } = await prompts({
                type: "text",
                name: "seed",
                message: theme.text.bold(`Enter a secret string to use as your identity seed in Semaphore:`),
                initial: false
            })
            identityString = seed as string
            setLocalBandadaIdentity(identityString as string)
        }
        // 3. create a semaphore identity with _identity string as a seed
        const identity = new Identity(identityString as string)

        // 4. check if the user is a member of the group
        console.log(`Checking Bandada membership...`)
        const isMember = await isGroupMember(BANDADA_GROUP_ID, identity)
        if (!isMember) {
            await addMemberToGroup(BANDADA_GROUP_ID, BANDADA_DASHBOARD_URL, identity)
        }

        // 5. generate a proof that the user owns the commitment.
        spinner.text = `Generating proof of identity...`
        spinner.start()
        // publicSignals = [hash(externalNullifier, identityNullifier), commitment]

        const initDirectoryName = getLocalDirname()
        const directoryName = initDirectoryName.includes("/src") ? "." : initDirectoryName

        const { proof, publicSignals } = await groth16.fullProve(
            {
                identityTrapdoor: identity.trapdoor,
                identityNullifier: identity.nullifier,
                externalNullifier: BANDADA_GROUP_ID
            },
            `${directoryName}/public/mini-semaphore.wasm`,
            `${directoryName}/public/mini-semaphore.zkey`
        )
        spinner.succeed(`Proof generated.\n`)
        spinner.text = `Sending proof to verification...`
        spinner.start()
        // 6. send proof to a cloud function that verifies it and checks membership
        const cf = httpsCallable(firebaseFunctions, commonTerms.cloudFunctionsNames.bandadaValidateProof)
        const result = await cf({
            proof,
            publicSignals
        })
        const { valid, token, message } = result.data as VerifiedBandadaResponse
        if (!valid) {
            showError(message, true)
            deleteLocalAccessToken()
            deleteLocalBandadaIdentity()
        }
        spinner.succeed(`Proof verified.\n`)
        spinner.text = `Authenticating...`
        spinner.start()
        // 7. Auth to p0tion firebase
        const userCredentials = await signInWithCustomToken(getAuth(), token)
        setLocalAccessToken(token)
        spinner.succeed(`Authenticated as ${theme.text.bold(userCredentials.user.uid)}.`)

        console.log(
            `\n${theme.symbols.warning} You can always log out by running the ${theme.text.bold(
                `phase2cli logout`
            )} command`
        )
    } catch (error) {
        // Delete local token.
        console.log("An error crashed the process. Deleting local token and identity.")
        console.error(error)
        deleteLocalAccessToken()
        deleteLocalBandadaIdentity()
    }

    process.exit(0)
}

export default authBandada
