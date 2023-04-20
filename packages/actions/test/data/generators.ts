import {
    UserDocumentReferenceAndData,
    CeremonyDocumentReferenceAndData,
    ParticipantDocumentReferenceAndData,
    CircuitDocumentReferenceAndData,
    ContributionDocumentReferenceAndData
} from "../../src/types"

/**
 * Create a fake user document (`users` collection).
 * @param fakeData <UserDocumentData> - input data for the fake user document.
 * @returns <UserDocumentData>
 */
export const generateFakeUser = (fakeData: UserDocumentReferenceAndData): UserDocumentReferenceAndData => ({
    uid: fakeData.uid,
    data: {
        name: fakeData.data.name,
        displayName: fakeData.data.displayName,
        creationTime: fakeData.data.creationTime,
        lastSignInTime: fakeData.data.lastSignInTime,
        lastUpdated: fakeData.data.lastUpdated,
        email: fakeData.data.email,
        emailVerified: fakeData.data.emailVerified,
        photoURL: fakeData.data.photoURL
    }
})

/**
 * Create a fake ceremony document (`ceremonies` collection).
 * @param fakeData <CeremonyDocumentData> - input data for the fake ceremony document.
 * @returns <CeremonyDocumentData>
 */
export const generateFakeCeremony = (fakeData: CeremonyDocumentReferenceAndData): CeremonyDocumentReferenceAndData => ({
    uid: fakeData.uid,
    data: {
        coordinatorId: fakeData.data.coordinatorId,
        title: fakeData.data.title,
        description: fakeData.data.description,
        prefix: fakeData.data.prefix,
        penalty: fakeData.data.penalty,
        startDate: fakeData.data.startDate,
        endDate: fakeData.data.endDate,
        state: fakeData.data.state,
        type: fakeData.data.type,
        timeoutMechanismType: fakeData.data.timeoutMechanismType,
        lastUpdated: fakeData.data.lastUpdated
    }
})

/**
 * Create a fake participant document (`ceremonies/<ceremony>/participants` collection).
 * @param fakeData <ParticipantDocumentData> - input data for the fake participant document.
 * @returns <ParticipantDocumentData>
 */
export const generateFakeParticipant = (
    fakeData: ParticipantDocumentReferenceAndData
): ParticipantDocumentReferenceAndData => ({
    uid: fakeData.uid,
    data: {
        userId: fakeData.data.userId,
        contributionProgress: fakeData.data.contributionProgress,
        status: fakeData.data.status,
        contributions: fakeData.data.contributions,
        lastUpdated: fakeData.data.lastUpdated,
        contributionStartedAt: fakeData.data.contributionStartedAt,
        contributionStep: fakeData.data.contributionStep,
        verificationStartedAt: fakeData.data.verificationStartedAt,
        // TODO: add checks.
        tempContributionData: fakeData.data.tempContributionData
            ? {
                  contributionComputationTime: fakeData.data.tempContributionData.contributionComputationTime,
                  uploadId: fakeData.data.tempContributionData.uploadId,
                  chunks: fakeData.data.tempContributionData.chunks
              }
            : undefined
    }
})

/**
 * Create a fake circuit document (`ceremonies/<ceremony>/circuits` collection).
 * @param fakeData <CircuitDocumentData> - input data for the fake ceremony document.
 * @returns <CircuitDocumentData>
 */
export const generateFakeCircuit = (fakeData: CircuitDocumentReferenceAndData): CircuitDocumentReferenceAndData => ({
    uid: fakeData.uid,
    data: {
        name: fakeData.data.name,
        description: fakeData.data.description,
        prefix: fakeData.data.prefix,
        sequencePosition: fakeData.data.sequencePosition,
        fixedTimeWindow: fakeData.data.fixedTimeWindow,
        zKeySizeInBytes: fakeData.data.zKeySizeInBytes,
        lastUpdated: fakeData.data.lastUpdated,
        metadata: {
            constraints: fakeData.data.metadata?.constraints!,
            curve: fakeData.data.metadata?.curve!,
            labels: fakeData.data.metadata?.labels!,
            outputs: fakeData.data.metadata?.outputs!,
            pot: fakeData.data.metadata?.pot!,
            privateInputs: fakeData.data.metadata?.privateInputs!,
            publicInputs: fakeData.data.metadata?.publicInputs!,
            wires: fakeData.data.metadata?.wires!
        },
        template: {
            commitHash: fakeData.data.template.commitHash,
            paramsConfiguration: fakeData.data.template.paramsConfiguration,
            source: fakeData.data.template.source
        },
        waitingQueue: {
            completedContributions: fakeData.data.waitingQueue?.completedContributions!,
            contributors: fakeData.data.waitingQueue?.contributors!,
            currentContributor: fakeData.data.waitingQueue?.currentContributor!,
            failedContributions: fakeData.data.waitingQueue?.failedContributions!
        },
        files: {
            initialZkeyBlake2bHash: fakeData.data.files?.initialZkeyBlake2bHash!,
            initialZkeyFilename: fakeData.data.files?.initialZkeyFilename!,
            initialZkeyStoragePath: fakeData.data.files?.initialZkeyStoragePath!,
            potBlake2bHash: fakeData.data.files?.potBlake2bHash!,
            potFilename: fakeData.data.files?.potFilename!,
            potStoragePath: fakeData.data.files?.potStoragePath!,
            r1csBlake2bHash: fakeData.data.files?.r1csBlake2bHash!,
            r1csFilename: fakeData.data.files?.r1csFilename!,
            r1csStoragePath: fakeData.data.files?.r1csStoragePath!,
            wasmBlake2bHash: fakeData.data.files?.wasmBlake2bHash!,
            wasmFilename: fakeData.data.files?.wasmFilename!,
            wasmStoragePath: fakeData.data.files?.wasmStoragePath!
        },
        avgTimings: {
            contributionComputation: fakeData.data.avgTimings?.contributionComputation!,
            fullContribution: fakeData.data.avgTimings?.fullContribution!,
            verifyCloudFunction: fakeData.data.avgTimings?.verifyCloudFunction!
        },
        compiler: {
            commitHash: fakeData.data.compiler.commitHash,
            version: fakeData.data.compiler.version
        }
    }
})

/**
 * Create a fake contribution document (`ceremonies/<ceremony>/circuits/<circuit>/contributions` collection).
 * @param fakeData <ParticipantDocumentData> - input data for the fake participant document.
 * @returns <ParticipantDocumentData>
 */
export const generateFakeContribution = (
    fakeData: ContributionDocumentReferenceAndData
): ContributionDocumentReferenceAndData => ({
    uid: fakeData.uid,
    data: {
        participantId: fakeData.data.participantId,
        contributionComputationTime: fakeData.data.contributionComputationTime,
        verificationComputationTime: fakeData.data.verificationComputationTime,
        zkeyIndex: fakeData.data.zkeyIndex,
        files: fakeData.data.files,
        verificationSoftware: fakeData.data.verificationSoftware,
        valid: fakeData.data.valid,
        lastUpdated: fakeData.data.lastUpdated,
        beacon: !fakeData.data.beacon ? undefined : fakeData.data.beacon
    }
})
