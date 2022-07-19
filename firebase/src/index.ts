import admin from "firebase-admin"
import { registerAuthUser, processSignUpWithCustomClaims } from "./auth.js"
import { startCeremony, stopCeremony } from "./ceremony.js"
import { setupCeremony, initEmptyWaitingQueueForCircuit } from "./setup.js"
import checkAndRegisterParticipant from "./contribute.js"
import {
  setParticipantReady,
  coordinateContributors,
  verifyContribution,
  refreshParticipantAfterContributionVerification
} from "./waitingQueue.js"
import { finalizeLastContribution, finalizeCeremony } from "./finalize.js"

admin.initializeApp()

export {
  registerAuthUser,
  processSignUpWithCustomClaims,
  startCeremony,
  stopCeremony,
  finalizeLastContribution,
  finalizeCeremony,
  setupCeremony,
  initEmptyWaitingQueueForCircuit,
  checkAndRegisterParticipant,
  setParticipantReady,
  coordinateContributors,
  verifyContribution,
  refreshParticipantAfterContributionVerification
}
