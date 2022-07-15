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
import { finalizeCircuit, finalizeCeremony } from "./finalize.js"

admin.initializeApp()

export {
  registerAuthUser,
  processSignUpWithCustomClaims,
  startCeremony,
  stopCeremony,
  finalizeCircuit,
  finalizeCeremony,
  setupCeremony,
  initEmptyWaitingQueueForCircuit,
  checkAndRegisterParticipant,
  setParticipantReady,
  coordinateContributors,
  verifyContribution,
  refreshParticipantAfterContributionVerification
}
