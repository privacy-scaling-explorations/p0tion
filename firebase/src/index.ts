import admin from "firebase-admin"
import { registerAuthUser, processSignUpWithCustomClaims } from "./auth.js"
import {
  startCeremony,
  stopCeremony,
  initWaitingQueueForCircuit,
  manageCeremonyParticipant,
  setParticipantReady,
  manageParticipantContributionProgress,
  increaseContributionProgressForParticipant
} from "./ceremony.js"

admin.initializeApp()

export {
  registerAuthUser,
  processSignUpWithCustomClaims,
  startCeremony,
  stopCeremony,
  initWaitingQueueForCircuit,
  manageCeremonyParticipant,
  setParticipantReady,
  manageParticipantContributionProgress,
  increaseContributionProgressForParticipant
}
