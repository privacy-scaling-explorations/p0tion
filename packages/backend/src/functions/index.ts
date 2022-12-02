import admin from "firebase-admin"

export { registerAuthUser, processSignUpWithCustomClaims } from "./auth"
export { startCeremony, stopCeremony } from "./ceremony"
export { setupCeremony, initEmptyWaitingQueueForCircuit } from "./setup"
export {
    checkParticipantForCeremony,
    checkAndRemoveBlockingContributor,
    progressToNextContributionStep,
    temporaryStoreCurrentContributionComputationTime,
    permanentlyStoreCurrentContributionTimeAndHash,
    temporaryStoreCurrentContributionMultiPartUploadId,
    temporaryStoreCurrentContributionUploadedChunkData
} from "./contribute"
export {
    coordinateContributors,
    verifycontribution,
    refreshParticipantAfterContributionVerification,
    makeProgressToNextContribution,
    resumeContributionAfterTimeoutExpiration
} from "./waitingQueue"
export { checkAndPrepareCoordinatorForFinalization, finalizeLastContribution, finalizeCeremony } from "./finalize"
export {
    createBucket,
    checkIfObjectExist,
    generateGetObjectPreSignedUrl,
    startMultiPartUpload,
    generatePreSignedUrlsParts,
    completeMultiPartUpload
} from "./storage"

admin.initializeApp()
