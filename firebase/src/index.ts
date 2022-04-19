import admin from "firebase-admin"
import { registerAuthUser, processSignUpWithCustomClaims } from "./auth.js"
import { startCeremony, stopCeremony } from "./ceremony.js"
import initEmptyWaitingQueueForCircuit from "./setup.js"

admin.initializeApp()

export { registerAuthUser, processSignUpWithCustomClaims, startCeremony, stopCeremony, initEmptyWaitingQueueForCircuit }
