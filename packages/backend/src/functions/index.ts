import admin from "firebase-admin"

export { registerAuthUser, processSignUpWithCustomClaims } from "./user"
export {
    startCeremony,
    stopCeremony,
    setupCeremony,
    initEmptyWaitingQueueForCircuit,
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
    refreshParticipantAfterContributionVerification,
    finalizeCircuit
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

const functions = require('firebase-functions');
const firestore = require('@google-cloud/firestore');
const client = new firestore.v1.FirestoreAdminClient();



const bucket = 'gs://p0tion-firestore-daily-backup';

exports.scheduledFirestoreExport = functions
    .region("europe-west1")
    .runWith({
        memory: "512MB"
    }).pubsub
    .schedule('every 24 hours')
    .onRun(() => {

        const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
        const databaseName =
            client.databasePath(projectId, '(default)');

        return client.exportDocuments({
            name: databaseName,
            outputUriPrefix: bucket,
            // Leave collectionIds empty to export all collections
            // or set to a list of collection IDs to export,
            // collectionIds: ['users', 'posts']
            collectionIds: []
        })
            .then((responses: any) => {
                const response = responses[0];
                console.log(`Operation Name: ${response['name']}`);
            })
            .catch((err: any) => {
                console.error(err);
                throw new Error('Export operation failed');
            });
    });


admin.initializeApp()
