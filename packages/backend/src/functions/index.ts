import admin from "firebase-admin"
import { registerAuthUser, processSignUpWithCustomClaims } from "./auth"
import { startCeremony, stopCeremony } from "./ceremony"
import { setupCeremony, initEmptyWaitingQueueForCircuit } from "./setup"
import {
    checkParticipantForCeremony,
    checkAndRemoveBlockingContributor,
    progressToNextContributionStep,
    temporaryStoreCurrentContributionComputationTime,
    permanentlyStoreCurrentContributionTimeAndHash,
    temporaryStoreCurrentContributionMultiPartUploadId,
    temporaryStoreCurrentContributionUploadedChunkData
} from "./contribute"
import {
    coordinateContributors,
    verifycontribution,
    refreshParticipantAfterContributionVerification,
    makeProgressToNextContribution,
    resumeContributionAfterTimeoutExpiration
} from "./waitingQueue"
import { checkAndPrepareCoordinatorForFinalization, finalizeLastContribution, finalizeCeremony } from "./finalize"
import {
    createBucket,
    checkIfObjectExist,
    generateGetObjectPreSignedUrl,
    startMultiPartUpload,
    generatePreSignedUrlsParts,
    completeMultiPartUpload
} from "./storage"

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
    checkParticipantForCeremony,
    checkAndRemoveBlockingContributor,
    progressToNextContributionStep,
    temporaryStoreCurrentContributionComputationTime,
    permanentlyStoreCurrentContributionTimeAndHash,
    temporaryStoreCurrentContributionMultiPartUploadId,
    temporaryStoreCurrentContributionUploadedChunkData,
    coordinateContributors,
    verifycontribution,
    refreshParticipantAfterContributionVerification,
    makeProgressToNextContribution,
    resumeContributionAfterTimeoutExpiration,
    createBucket,
    checkIfObjectExist,
    generateGetObjectPreSignedUrl,
    startMultiPartUpload,
    generatePreSignedUrlsParts,
    completeMultiPartUpload
}
