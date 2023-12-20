import * as functions from "firebase-functions"

import { BandadaValidateProof } from "../types/index"

const bandadaValidateProof = functions
    .region("europe-west1")
    .runWith({
        memory: "512MB"
    })
    .https.onCall(async (data: BandadaValidateProof, context: functions.https.CallableContext): Promise<any> => {
        console.log(data)
        console.log(context)
    })

export default bandadaValidateProof
