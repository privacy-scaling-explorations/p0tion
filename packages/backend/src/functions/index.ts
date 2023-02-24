import admin from "firebase-admin"

export { registerAuthUser, processSignUpWithCustomClaims } from "./user"
export {
    startCeremony,
    stopCeremony,
    setupCeremony,
    initEmptyWaitingQueueForCircuit,
    finalizeLastContribution,
    finalizeCeremony
} from "./ceremony"
export {
    checkParticipantForCeremony,
    progressToNextContributionStep,
    permanentlyStoreCurrentContributionTimeAndHash,
    temporaryStoreCurrentContributionMultiPartUploadId,
    temporaryStoreCurrentContributionUploadedChunkData,
    progressToNextCircuitForContribution,
    checkAndPrepareCoordinatorForFinalization
} from "./participant"
export {
    coordinateCeremonyParticipant,
    verifycontribution,
    refreshParticipantAfterContributionVerification
} from "./circuit"
export {
    createBucket,
    checkIfObjectExist,
    generateGetObjectPreSignedUrl,
    startMultiPartUpload,
    generatePreSignedUrlsParts,
    completeMultiPartUpload
} from "./storage"
export { checkAndRemoveBlockingContributor, resumeContributionAfterTimeoutExpiration } from "./timeout"

admin.initializeApp()
