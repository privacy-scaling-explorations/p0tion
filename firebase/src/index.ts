import admin from "firebase-admin"
import { registerAuthUser, processSignUpWithCustomClaims } from "./auth.js"
import { startCeremony, stopCeremony } from "./ceremony.js"
import initEmptyWaitingQueueForCircuit from "./setup.js"
import checkAndRegisterParticipant from "./contribute.js"
import {
  setParticipantReady,
  coordinateContributors,
  verifyContribution,
  refreshParticipantAfterContributionVerification
} from "./waitingQueue.js"

admin.initializeApp()

export {
  registerAuthUser,
  processSignUpWithCustomClaims,
  startCeremony,
  stopCeremony,
  initEmptyWaitingQueueForCircuit,
  checkAndRegisterParticipant,
  setParticipantReady,
  coordinateContributors,
  verifyContribution,
  refreshParticipantAfterContributionVerification
}
