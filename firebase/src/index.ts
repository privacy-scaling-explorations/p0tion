import admin from "firebase-admin"
import { registerAuthUser, processSignUpWithCustomClaims } from "./auth.js"
import { startCeremony, stopCeremony } from "./ceremony.js"
import { setupCeremony, initEmptyWaitingQueueForCircuit } from "./setup.js"
import { checkAndRegisterParticipant, checkAndRemoveBlockingContributor } from "./contribute.js"
import {
  setParticipantReady,
  coordinateContributors,
  verifycontribution,
  refreshParticipantAfterContributionVerification
} from "./waitingQueue.js"
import { finalizeLastContribution, finalizeCeremony } from "./finalize.js"
import {
  createBucket,
  checkIfObjectExist,
  generateGetOrPutObjectPreSignedUrl,
  startMultiPartUpload,
  generatePreSignedUrlsParts,
  completeMultiPartUpload
} from "./storage.js"

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
  checkAndRemoveBlockingContributor,
  setParticipantReady,
  coordinateContributors,
  verifycontribution,
  refreshParticipantAfterContributionVerification,
  createBucket,
  checkIfObjectExist,
  generateGetOrPutObjectPreSignedUrl,
  startMultiPartUpload,
  generatePreSignedUrlsParts,
  completeMultiPartUpload
}
