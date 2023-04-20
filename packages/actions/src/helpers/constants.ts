// Main part for the Hermez Phase 1 Trusted Setup URLs to download PoT files.
export const potFileDownloadMainUrl = `https://hermez.s3-eu-west-1.amazonaws.com/`
// Main part for the Hermez Phase 1 Trusted Setup PoT files to be downloaded.
export const potFilenameTemplate = `powersOfTau28_hez_final_`
// The genesis zKey index.
export const genesisZkeyIndex = `00000`
// The number of exponential iterations to be executed by SnarkJS when finalizing the ceremony.
export const numExpIterations = 10
// The Solidity version of the Verifier Smart Contract generated with SnarkJS when finalizing the ceremony.
export const solidityVersion = "0.8.0"
// The index of the final zKey.
export const finalContributionIndex = "final"
// The acronym for verification key.
export const verificationKeyAcronym = "vkey"
// The acronym for Verifier smart contract.
export const verifierSmartContractAcronym = "verifier"

/**
 * Commonly used terms.
 * @dev useful for creating paths, references to collections and queries, object properties, folder names, and so on.
 */
export const commonTerms = {
    collections: {
        users: {
            name: "users",
            fields: {
                creationTime: "creationTime",
                displayName: "displayName",
                email: "email",
                emailVerified: "emailVerified",
                lastSignInTime: "lastSignInTime",
                lastUpdated: "lastUpdated",
                name: "name",
                photoURL: "photoURL"
            }
        },
        participants: {
            name: "participants",
            fields: {
                contributionProgress: "contributionProgress",
                contributionStartedAt: "contributionStartedAt",
                contributionStep: "contributionStep",
                contributions: "contributions",
                lastUpdated: "lastUpdated",
                status: "status",
                verificationStartedAt: "verificationStartedAt"
            }
        },
        ceremonies: {
            name: "ceremonies",
            fields: {
                coordinatorId: "coordinatorId",
                description: "description",
                endDate: "endDate",
                lastUpdated: "lastUpdated",
                penalty: "penalty",
                prefix: "prefix",
                startDate: "startDate",
                state: "state",
                timeoutType: "timeoutType",
                title: "title",
                type: "type"
            }
        },
        circuits: {
            name: "circuits",
            fields: {
                avgTimings: "avgTimings",
                compiler: "compiler",
                description: "description",
                files: "files",
                lastUpdated: "lastUpdated",
                metadata: "metadata",
                name: "name",
                prefix: "prefix",
                sequencePosition: "sequencePosition",
                template: "template",
                timeoutMaxContributionWaitingTime: "timeoutMaxContributionWaitingTime",
                waitingQueue: "waitingQueue",
                zKeySizeInBytes: "zKeySizeInBytes"
            }
        },
        contributions: {
            name: "contributions",
            fields: {
                contributionComputationTime: "contributionComputationTime",
                files: "files",
                lastUpdated: "lastUpdated",
                participantId: "participantId",
                valid: "valid",
                verificationComputationTime: "verificationComputationTime",
                zkeyIndex: "zKeyIndex"
            }
        },
        timeouts: {
            name: "timeouts",
            fields: {
                type: "type",
                startDate: "startDate",
                endDate: "endDate"
            }
        }
    },
    foldersAndPathsTerms: {
        output: `output`,
        setup: `setup`,
        contribute: `contribute`,
        finalize: `finalize`,
        pot: `pot`,
        zkeys: `zkeys`,
        wasm: `wasm`,
        vkeys: `vkeys`,
        metadata: `metadata`,
        transcripts: `transcripts`,
        attestation: `attestation`,
        verifiers: `verifiers`
    },
    cloudFunctionsNames: {
        setupCeremony: "setupCeremony",
        checkParticipantForCeremony: "checkParticipantForCeremony",
        progressToNextCircuitForContribution: "progressToNextCircuitForContribution",
        resumeContributionAfterTimeoutExpiration: "resumeContributionAfterTimeoutExpiration",
        createBucket: "createBucket",
        generateGetObjectPreSignedUrl: "generateGetObjectPreSignedUrl",
        progressToNextContributionStep: "progressToNextContributionStep",
        permanentlyStoreCurrentContributionTimeAndHash: "permanentlyStoreCurrentContributionTimeAndHash",
        startMultiPartUpload: "startMultiPartUpload",
        temporaryStoreCurrentContributionMultiPartUploadId: "temporaryStoreCurrentContributionMultiPartUploadId",
        temporaryStoreCurrentContributionUploadedChunkData: "temporaryStoreCurrentContributionUploadedChunkData",
        generatePreSignedUrlsParts: "generatePreSignedUrlsParts",
        completeMultiPartUpload: "completeMultiPartUpload",
        checkIfObjectExist: "checkIfObjectExist",
        verifyContribution: "verifycontribution",
        checkAndPrepareCoordinatorForFinalization: "checkAndPrepareCoordinatorForFinalization",
        finalizeCircuit: "finalizeCircuit",
        finalizeCeremony: "finalizeCeremony"
    }
}
