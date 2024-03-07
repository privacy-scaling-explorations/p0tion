import dotenv from "dotenv"
import fetch from "@adobe/node-fetch-retry"
import * as functions from "firebase-functions"
import { getAuth } from "firebase-admin/auth"
import admin from "firebase-admin"
import { Auth0UserInfo, CheckNonceOfSIWEAddressRequest, CheckNonceOfSIWEAddressResponse } from "../types"
import { setEthProvider } from "../lib/services"

dotenv.config()

export const checkNonceOfSIWEAddress = functions
    .region("europe-west1")
    .runWith({ memory: "1GB" })
    .https.onCall(async (data: CheckNonceOfSIWEAddressRequest): Promise<CheckNonceOfSIWEAddressResponse> => {
        try {
            const { auth0Token } = data
            const result = (await fetch(`${process.env.AUTH0_APPLICATION_URL}/userinfo`, {
                method: "GET",
                headers: {
                    "content-type": "application/json",
                    authorization: `Bearer ${auth0Token}`
                }
            }).then((_res) => _res.json())) as Auth0UserInfo
            if (!result.sub) {
                return {
                    valid: false,
                    message: "No user detected. Please check device flow token"
                }
            }
            const auth = getAuth()
            // check nonce
            const parts = result.sub.split("|")
            const address = decodeURIComponent(parts[2]).split("eip155:534352:")[1]

            const minimumNonce = Number(process.env.ETH_MINIMUM_NONCE)
            const nonceBlockHeight = "latest" // process.env.ETH_NONCE_BLOCK_HEIGHT
            // look up nonce for address @block
            let nonceOk = true
            if (minimumNonce > 0) {
                const provider = setEthProvider()
                console.log(`got provider - block # ${await provider.getBlockNumber()}`)
                const nonce = await provider.getTransactionCount(address, nonceBlockHeight)
                console.log(`nonce ${nonce}`)
                nonceOk = nonce >= minimumNonce
            }
            console.log(`checking nonce ${nonceOk}`)
            if (!nonceOk) {
                return {
                    valid: false,
                    message: "Eth address does not meet the nonce requirements"
                }
            }
            await admin.auth().createUser({
                displayName: address,
                uid: address
            })
            const token = await auth.createCustomToken(address)
            return {
                valid: true,
                token
            }
        } catch (error) {
            return {
                valid: false,
                message: `Something went wrong ${error}`
            }
        }
    })

export default checkNonceOfSIWEAddress
