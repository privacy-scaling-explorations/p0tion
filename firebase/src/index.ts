import admin from "firebase-admin"
import { registerAuthUser, processSignUpWithCustomClaims } from "./auth.js"
import { startCeremony, stopCeremony } from "./ceremony.js"
import { setupCeremony, initEmptyWaitingQueueForCircuit } from "./setup.js"
import {
  checkAndRegisterParticipant,
  checkAndRemoveBlockingContributor,
  progressToNextContributionStep,
  temporaryStoreCurrentContributionComputationTime,
  permanentlyStoreCurrentContributionTimeAndHash,
  temporaryStoreCurrentContributionMultiPartUploadId,
  temporaryStoreCurrentContributionUploadedChunkData
} from "./contribute.js"
import {
  setParticipantReady,
  coordinateContributors,
  verifycontribution,
  refreshParticipantAfterContributionVerification
} from "./waitingQueue.js"
import { checkAndPrepareCoordinatorForFinalization, finalizeLastContribution, finalizeCeremony } from "./finalize.js"
import {
  createBucket,
  checkIfObjectExist,
  generateGetObjectPreSignedUrl,
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
  checkAndPrepareCoordinatorForFinalization,
  finalizeLastContribution,
  finalizeCeremony,
  setupCeremony,
  initEmptyWaitingQueueForCircuit,
  checkAndRegisterParticipant,
  checkAndRemoveBlockingContributor,
  progressToNextContributionStep,
  temporaryStoreCurrentContributionComputationTime,
  permanentlyStoreCurrentContributionTimeAndHash,
  temporaryStoreCurrentContributionMultiPartUploadId,
  temporaryStoreCurrentContributionUploadedChunkData,
  setParticipantReady,
  coordinateContributors,
  verifycontribution,
  refreshParticipantAfterContributionVerification,
  createBucket,
  checkIfObjectExist,
  generateGetObjectPreSignedUrl,
  startMultiPartUpload,
  generatePreSignedUrlsParts,
  completeMultiPartUpload
}
