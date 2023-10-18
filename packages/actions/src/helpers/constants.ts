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
// The tag for ec2 instances.
export const ec2InstanceTag = "p0tionec2instance"
// The name of the VM startup script file.
export const vmBootstrapScriptFilename = "bootstrap.sh"

/**
 * Define the supported VM configuration types.
 * @dev the VM configurations can be retrieved at https://aws.amazon.com/ec2/instance-types/
 * The on-demand prices for the configurations can be retrieved at https://aws.amazon.com/ec2/pricing/on-demand/.
 * @notice the price has to be intended as on-demand hourly billing usage for Linux OS
 * VMs located in the us-east-1 region expressed in USD.
 */
export const vmConfigurationTypes = {
    t3_large: {
        type: "t3.large",
        ram: 8,
        vcpu: 2,
        pricePerHour: 0.08352
    },
    t3_2xlarge: {
        type: "t3.2xlarge",
        ram: 32,
        vcpu: 8,
        pricePerHour: 0.3328
    },
    c5_9xlarge: {
        type: "c5.9xlarge",
        ram: 72,
        vcpu: 36,
        pricePerHour: 1.53
    },
    c5_18xlarge: {
        type: "c5.18xlarge",
        ram: 144,
        vcpu: 72,
        pricePerHour: 3.06
    },
    c5a_8xlarge: {
        type: "c5a.8xlarge",
        ram: 64,
        vcpu: 32,
        pricePerHour: 1.232
    },
    c6id_32xlarge: {
        type: "c6id.32xlarge",
        ram: 256,
        vcpu: 128,
        pricePerHour: 6.4512
    },
    m6a_32xlarge: {
        type: "m6a.32xlarge",
        ram: 512,
        vcpu: 128,
        pricePerHour: 5.5296
    }
}

/**
 * Define the PPoT Trusted Setup ceremony output powers of tau files size (in GB).
 * @dev the powers of tau files can be retrieved at https://github.com/weijiekoh/perpetualpowersoftau
 */
export const powersOfTauFiles = [
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_01.ptau",
        size: 0.000084
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_02.ptau",
        size: 0.000086
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_03.ptau",
        size: 0.000091
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_04.ptau",
        size: 0.0001
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_05.ptau",
        size: 0.000117
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_06.ptau",
        size: 0.000153
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_07.ptau",
        size: 0.000225
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_08.ptau",
        size: 0.0004
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_09.ptau",
        size: 0.000658
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau",
        size: 0.0013
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_11.ptau",
        size: 0.0023
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau",
        size: 0.0046
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_13.ptau",
        size: 0.0091
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau",
        size: 0.0181
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau",
        size: 0.0361
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau",
        size: 0.0721
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_17.ptau",
        size: 0.144
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_18.ptau",
        size: 0.288
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_19.ptau",
        size: 0.576
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_20.ptau",
        size: 1.1
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_21.ptau",
        size: 2.3
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_22.ptau",
        size: 4.5
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_23.ptau",
        size: 9.0
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_24.ptau",
        size: 18.0
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_25.ptau",
        size: 36.0
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_26.ptau",
        size: 72.0
    },
    {
        ref: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_27.ptau",
        size: 144.0
    }
]

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
        avatars: {
            name: "avatars",
            fields: {
                avatarUrl: "avatarUrl"
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
                zKeySizeInBytes: "zKeySizeInBytes",
                verification: "verification"
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
        finalizeCeremony: "finalizeCeremony",
        downloadCircuitArtifacts: "downloadCircuitArtifacts",
        transferObject: "transferObject"
    }
}
