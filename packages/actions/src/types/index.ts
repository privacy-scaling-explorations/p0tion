import { FirebaseApp } from "firebase/app"
import { DocumentReference, DocumentData, Firestore } from "firebase/firestore"
import { Functions } from "firebase/functions"
import {
    CeremonyState,
    CeremonyTimeoutType,
    CeremonyType,
    CircuitContributionVerificationMechanism,
    DiskTypeForVM,
    ParticipantContributionStep,
    ParticipantStatus
} from "./enums.js"

/**
 * A shared type that groups all the AWS services variables.
 * @typedef {Object} AWSVariables
 * @property {string} accessKeyId - the key identifier related to S3 APIs.
 * @property {string} secretAccessKey - the secret access key related to S3 APIs.
 * @property {string} region - the region where your buckets are located.
 * @property {string} roleArn - the EC2 instance role to access S3.
 * @property {string} amiId - the AWS AMI ID (default to Amazon Linux 2).
 */
export type AWSVariables = {
    accessKeyId: string
    secretAccessKey: string
    region: string
    roleArn: string
    instanceProfileArn: string
    amiId: string
}

/**
 * A shared type that groups all the Firebase services used in the application context.
 * @typedef {Object} FirebaseServices
 * @property {FirebaseApp} firebaseApp - the instance of the Firebase application.
 * @property {Firestore} firestoreDatabase - the instance of the Firestore database in use for the application.
 * @property {Functions} firebaseFunctions - the instance of the Cloud Functions in use for the application.
 */
export type FirebaseServices = {
    firebaseApp: FirebaseApp
    firestoreDatabase: Firestore
    firebaseFunctions: Functions
}

/**
 * Useful for interacting with reference and data from a Firestore document at the same time.
 * @typedef {Object} FirebaseDocumentInfo
 * @property {string} id - the unique identifier of the Firestore document.
 * @property {DocumentReference<DocumentData>} ref - the Firestore reference for the document (useful for queries).
 * @property {DocumentData} data - the Firestore document whole data.
 */
export type FirebaseDocumentInfo = {
    id: string
    ref: DocumentReference<DocumentData>
    data: DocumentData
}

/**
 * Define a custom file data chunk associated with a pre-signed url.
 * @dev Useful when interacting with AWS S3 buckets using pre-signed urls for multi-part upload or download storing temporary information on the database.
 * @typedef {Object} ChunkWithUrl
 * @property {number} partNumber - indicate where the chunk is positioned in order to reconhstruct the file with multiPartUpload/Download.
 * @property {Buffer} chunk - the piece of information in bytes.
 * @property {string} preSignedUrl - the unique reference to the pre-signed url to which this chunk is linked too.
 */
export type ChunkWithUrl = {
    partNumber: number
    chunk: Buffer
    preSignedUrl: string
}

/**
 * Group a pre-signed url chunk core information.
 * @typedef {Object} ETagWithPartNumber
 * @property {string | null} ETag - a unique reference to this chunk associated to a pre-signed url.
 * @property {number} PartNumber - indicate where the chunk is positioned in order to reconhstruct the file with multiPartUpload/Download.
 */
export type ETagWithPartNumber = {
    ETag: string | undefined
    PartNumber: number
}

/**
 * Group the information when retrieving the validity of a contribution for a contributor.
 * @typedef {Object} ContributionValidity
 * @property {string} contributionId - the unique identifier of the contribution.
 * @property {string} circuitId - the unique identifier of the circuit for which the contribution was computed.
 * @property {boolean} valid - true if and only if the contribution is valid; otherwise false.
 */
export type ContributionValidity = {
    contributionId: string
    circuitId: string
    valid: boolean
}

/**
 * Necessary data to define a user database document.
 * @typedef {Object} UserDocument
 * @property {string} name - the name of the user.
 * @property {string | undefined} displayName - the public (visible) name of the user.
 * @property {number} creationTime - the timestamp when the document has been created.
 * @property {number} lastSignInTime - the timestamp when the user has been authenticated for the last time.
 * @property {number} lastUpdated - the timestamp where the last update of the Firestore document has happened.
 * @property {string} email - the email of the user.
 * @property {boolean} emailVerified - true when the email of the user has been verified; otherwise false.
 * @property {string | undefined} photoURL - the external url of the profile photo of the user.
 */
export type UserDocument = {
    name: string
    displayName: string | undefined
    creationTime: number
    lastSignInTime: number
    lastUpdated: number
    email: string
    emailVerified: boolean
    photoURL: string | undefined
}

/**
 * Groups all the information received as input from the coordinator when creating a ceremony.
 * @typedef {Object} CeremonyInputData
 * @property {string} title - the title/name of the ceremony.
 * @property {string} description - a brief description of the ceremony.
 * @property {number} startDate - the start (opening to contributions) date for the ceremony (in ms).
 * @property {number} endDate - the end (closing to contributions) date for the ceremony (in ms).
 * @property {CeremonyTimeoutType} timeoutMechanismType - the timeout mechanism type used for avoiding blocking contribution behaviours.
 * @property {number} penalty - the amount of time expressed in minutes that the blocking contributor has to wait before joining the waiting queue again.
 */
export type CeremonyInputData = {
    title: string
    description: string
    startDate: number
    endDate: number
    timeoutMechanismType: CeremonyTimeoutType
    penalty: number
}

/**
 * Group information about the version of the Circom compiler used for the ceremony circuits.
 * @typedef {Object} CircomCompilerData
 * @property {string} version - the version of the Circom compiler.
 * @property {string} commitHash - the commit hash of the version of the Circom compiler.
 */
export type CircomCompilerData = {
    version: string
    commitHash: string
}

/**
 * Group information about the Circom circuit template used for the ceremony circuits.
 * @dev we are assuming that the circuit template have been published to a public repository (as Github).
 * @typedef {Object} SourceTemplateData
 * @property {string} source - the external link where the circuit template has been published.
 * @property {string} commitHash - the commit hash of the version of the circuit template.
 * @property {Array<string>} paramsConfiguration - the list of parameter values used to configure the circuit template (if any).
 */
export type SourceTemplateData = {
    source: string
    commitHash: string
    paramsConfiguration: Array<string>
}

/**
 * The references about the artifacts produced during the compilation of the ceremony circuit.
 * @typedef {Object} CompilationArtifacts
 * @property {string} r1csFilename - the name of the R1CS file.
 * @property {string} wasmFilename - the name of the WASM file.
 */
export type CompilationArtifacts = {
    r1csFilename: string
    wasmFilename: string
}

/**
 * Group information about the VM configuration for circuit contribution verification.
 * @dev the coordinator could choose among CF and VM.
 * @notice the VM configurations could be retrieved at https://aws.amazon.com/ec2/instance-types/.
 * @typedef {Object} VMConfiguration
 * @property {string} [vmConfigurationType] - the VM configuration type.
 * @property {string} [vmDiskType] - the VM volume type (e.g., gp2)
 * @property {number} [vmDiskSize] - the VM disk size in GB.
 * @property {string} [vmInstanceId] - the VM instance identifier (after VM instantiation).
 */
export type VMConfiguration = {
    vmConfigurationType?: string
    vmDiskType?: DiskTypeForVM
    vmDiskSize?: number
    vmInstanceId?: string
}

/**
 * Group information about the circuit contribution verification mechanism.
 * @typedef {Object} CircuitContributionVerification
 * @property {CircuitContributionVerificationMechanism} cfOrVm - the mechanism choosen by the coordinator.
 * @property {VMConfiguration} [vm] - the VM configuration specs.
 */
export type CircuitContributionVerification = {
    cfOrVm: CircuitContributionVerificationMechanism
    vm?: VMConfiguration
}

/**
 * Group input data for defining a ceremony circuit.
 * @dev The data is both entered by the coordinator and derived.
 * @typedef {Object} CircuitInputData
 * @property {string} description - a short description for the circuit.
 * @property {CircomCompilerData} compiler - the info about the Circom compiler used to compile the circuit template.
 * @property {SourceTemplateData} template - the info about the circuit template.
 * @property {CircuitContributionVerification} verification - the info about the circuit contribution verification mechanism.
 * @property {CompilationArtifacts} compilationArtifacts - the references about the circuit compilation artifacts.
 * @property {CircuitMetadata} [metadata] - the info about the R1CS file.
 * @property {string} [name] - the name of the circuit.
 * @property {number} [dynamicThreshold] - the dynamic timeout threshold expressed in percentage.
 * @property {number} [fixedTimeWindow] - the amount of fixed max contribution time which can be spent while contributing before the timeout can be triggered.
 * @property {number} [sequencePosition] - the position which define the order of contributions in the ceremony.
 * @property {string} [prefix] - the prefix of the circuit derived from the name.
 * @property {number} [zKeySizeInBytes] - the size of the related zKey expressed in bytes.
 */
export type CircuitInputData = {
    description: string
    compiler: CircomCompilerData
    template: SourceTemplateData
    verification: CircuitContributionVerification
    compilationArtifacts?: CompilationArtifacts
    metadata?: CircuitMetadata
    name?: string
    dynamicThreshold?: number
    fixedTimeWindow?: number
    sequencePosition?: number
    prefix?: string
    zKeySizeInBytes?: number
}

/**
 * Necessary data to define a ceremony database document.
 * @dev The data is both entered by the coordinator and derived.
 * @typedef {Object} CeremonyDocument
 * @property {string} prefix - the prefix of the ceremony derived from the name.
 * @property {CeremonyState} state - the current state of the ceremony.
 * @property {CeremonyType} type - the type of the ceremony.
 * @property {string} coordinatorId - the unique identifier of the coordinator.
 * @property {number} lastUpdated - the timestamp where the last update of the Firestore document has happened.
 */
export type CeremonyDocument = CeremonyInputData & {
    prefix: string
    state: CeremonyState
    type: CeremonyType
    coordinatorId: string
    lastUpdated: number
}

/**
 * Data defining a contribution made by a participant.
 * @typedef {Object} Contribution
 * @property {string} doc - the unique identifier of the document related to the contribution.
 * @property {number} computationTime - the overall time spent while computing the contribution.
 * @property {string} hash - the contribution hash (generated as output from the snarkjs command).
 */
export type Contribution = {
    doc: string
    computationTime: number
    hash: string
}

/**
 * Auxiliary data needed for resumption in an intermediate step of contribution.
 * @dev The data is used when the current contributorinterrupts during the download, contribute, upload steps
 * to prevent it from having to start over but can pick up where it left off.
 * This restart operation does NOT interact with the timeout mechanism (which remains unchanged).
 * @typedef {Object} TemporaryParticipantContributionData
 * @property {number} contributionComputationTime - the time spent since the contribution start.
 * @property {string} uploadId - the unique identifier of the pre-signed url PUT request to upload the newest contribution.
 * @property {Array<ETagWithPartNumber>} chunks - the list of ETags and PartNumbers that make up the chunks.
 */
export type TemporaryParticipantContributionData = {
    contributionComputationTime: number
    uploadId: string
    chunks: Array<ETagWithPartNumber>
}

/**
 * Necessary data to define a participant database document.
 * @typedef {Object} ParticipantDocument
 * @property {string} userId - the unique identifier of the user associated with the participant.
 * @property {number} contributionProgress - indicates the number of the circuit for which the user has to wait in the queue.
 * @property {ParticipantStatus} status - the current status of the participant.
 * @property {Array<Contribution>} contributions - the list of references to the contributions computed by the participant.
 * @property {number} lastUpdated - the timestamp where the last update of the Firestore document has happened.
 * @property {number} [contributionStartedAt] - the timestamp of when the latest contribution has started.
 * @property {number} [verificationStartedAt] - the timestamp of when the latest verification process has started.
 * @property {TemporaryParticipantContributionData} [tempContributionData] - the auxiliary data needed for resumption in an intermediate step of contribution.
 */
export type ParticipantDocument = {
    userId: string
    contributionProgress: number
    status: ParticipantStatus
    contributions: Array<Contribution>
    lastUpdated: number
    contributionStartedAt: number
    contributionStep?: ParticipantContributionStep
    verificationStartedAt?: number
    tempContributionData?: TemporaryParticipantContributionData
}

/**
 * The metadata of a Groth16 circuit.
 * @dev The data is derived by reading the R1CS file.
 * @typedef {Object} CircuitMetadata
 * @property {string} curve - the curve used by the proving system for circuit construction.
 * @property {number} wires - the circuit amount of wires among field/gates.
 * @property {number} constraints - the amount of constraints (= the size of the circuit).
 * @property {number} privateInputs - the amount of private inputs (derived from constraints).
 * @property {number} publicInputs - the amount of public inputs (derived from constraints).
 * @property {number} labels - the amount of labels.
 * @property {number} outputs - the amount of outputs.
 * @property {number} pot - the smallest amount of powers needed to work with the circuit (Powers of Tau from Phase 1 setup).
 */
export type CircuitMetadata = {
    curve: string
    wires: number
    constraints: number
    privateInputs: number
    publicInputs: number
    labels: number
    outputs: number
    pot: number
}

/**
 * The references about the artifacts produced during the ceremony for a circuit.
 * @dev The references are related to the storage solution used where the files are stored (currently AWS S3).
 * @typedef {Object} CircuitArtifacts
 * @property {string} potFilename - the name of the Powers of Tau file.
 * @property {string} r1csFilename - the name of the R1CS file.
 * @property {string} wasmFilename - the name of the WASM file.
 * @property {string} initialZkeyFilename - the name of the initial (= genesis) zKey file.
 * @property {string} potStoragePath - the storage path of the Powers of Tau file.
 * @property {string} r1csStoragePath - the storage path of the R1CS file.
 * @property {string} wasmStoragePath - the storage path of the WASM file.
 * @property {string} initialZkeyStoragePath - the storage path of the initial (= genesis) zKey file.
 * @property {string} potBlake2bHash - the blake2b hash of the Powers of Tau file.
 * @property {string} r1csBlake2bHash - the blake2b hash of the R1CS file.
 * @property {string} wasmBlake2bHash - the blake2b hash of the WASM file.
 * @property {string} initialZkeyBlake2bHash - the blake2b hash of the initial (= genesis) zKey file.
 */
export type CircuitArtifacts = {
    potFilename: string
    r1csFilename: string
    wasmFilename: string
    initialZkeyFilename: string
    potStoragePath: string
    r1csStoragePath: string
    wasmStoragePath: string
    initialZkeyStoragePath: string
    potBlake2bHash: string
    r1csBlake2bHash: string
    wasmBlake2bHash: string
    initialZkeyBlake2bHash: string
}

/**
 * The references about the average time spent by contributors on the circuit.
 * @typedef {Object} CircuitTimings
 * @property {number} contributionComputation - the average amount of time spent for contribution computation only.
 * @property {number} fullContribution - the average amount of time spent for the whole contribution.
 * @property {number} verifyCloudFunction - the average amount of time spent for verification of contribution only.
 */
export type CircuitTimings = {
    contributionComputation: number
    fullContribution: number
    verifyCloudFunction: number
}

/**
 * The information to handle the queue for circuit contributions.
 * @typedef {Object} CircuitWaitingQueue
 * @property {number} completedContributions - the total amount of completed contributions.
 * @property {Array<string>} contributors - the list of unique identifiers of the participants waiting for contributing.
 * @property {string} currentContributor - the unique identifier of the participant who is currently contributing.
 * @property {number} failedContributions - the total amount of failed contributions.
 */
export type CircuitWaitingQueue = {
    completedContributions: number
    contributors: Array<string>
    currentContributor: string
    failedContributions: number
}

/**
 * Necessary data to define a circuit database document.
 * @typedef {Object} CircuitDocument
 * @property {CircuitMetadata} metadata - the info about the circuit metadata.
 * @property {CircuitArtifacts} [files] - the references about the circuit artifacts.
 * @property {CircuitTimings} [avgTimings] - the info about the average timings for the circuit.
 * @property {SourceTemplateData} [template] - the info about the circuit template.
 * @property {CircomCompilerData} [compiler] - the info about the circom compiler.
 * @property {CircuitWaitingQueue} [waitingQueue] - the info about the circuit waiting queue.
 * @property {number} [lastUpdated] - the timestamp where the last update of the Firestore document has happened.
 */
export type CircuitDocument = CircuitInputData & {
    metadata?: CircuitMetadata
    files?: CircuitArtifacts
    avgTimings?: CircuitTimings
    template?: SourceTemplateData
    compiler?: CircomCompilerData
    waitingQueue?: CircuitWaitingQueue
    lastUpdated?: number
}

/**
 * The references about the artifacts produced during the contribution (either final or not) to a ceremony circuit.
 * @dev The references are related to the storage solution used where the files are stored (currently AWS S3).
 * @typedef {Object} ContributionFiles
 * @property {string} transcriptFilename - the name of the transcript file.
 * @property {string} lastZkeyFilename - the name of the contribution (zKey) file.
 * @property {string} transcriptStoragePath - the storage path of the transcript file.
 * @property {string} lastZkeyStoragePath - the storage path of the contribution (zKey) file.
 * @property {string} transcriptBlake2bHash - the blake2b hash of the transcript file.
 * @property {string} lastZkeyBlake2bHash - the blake2b hash of the contribution (zKey) file.
 * @property {string} [verificationKeyBlake2bHash] - the blake2b hash of the verification key file (final contribution only).
 * @property {string} [verificationKeyFilename] - the name of the verification key file (final contribution only).
 * @property {string} [verificationKeyStoragePath] - the storage path of the verification key file (final contribution only).
 * @property {string} [verifierContractBlake2bHash] - the blake2b hash of the verifier smart contract file (final contribution only).
 * @property {string} [verifierContractFilename] - the name of the verifier smart contract file (final contribution only).
 * @property {string} [verifierContractStoragePath] - the storage path of the verifier smart contract file (final contribution only).
 */
export type ContributionFiles = {
    transcriptFilename: string
    lastZkeyFilename: string
    transcriptStoragePath: string
    lastZkeyStoragePath: string
    transcriptBlake2bHash: string
    lastZkeyBlake2bHash: string
    verificationKeyBlake2bHash?: string
    verificationKeyFilename?: string
    verificationKeyStoragePath?: string
    verifierContractBlake2bHash?: string
    verifierContractFilename?: string
    verifierContractStoragePath?: string
}

/**
 * Group information about the version of the verification software used for contribution verification.
 * @typedef {Object} ContributionVerificationSoftware
 * @property {string} name - the name of the verification software.
 * @property {string} version - the version of the verification software.
 * @property {string} commitHash - the commit hash of the version of the verification software.
 */
export type ContributionVerificationSoftware = {
    name: string
    version: string
    commitHash: string
}

/**
 * Group information about the value (beacon) used to compute the final contribution while finalizing the ceremony.
 * @typedef {Object} BeaconInfo
 * @property {string} value - the value of the beacon.
 * @property {string} hash - the SHA 256 hash of the beacon.
 */
export type BeaconInfo = {
    value: string
    hash: string
}

/**
 * Necessary data to define a contribution document.
 * @typedef {Object} ContributionDocument
 * @property {string} participantId - the unique identifier of the contributor.
 * @property {number} contributionComputationTime - the amount of time spent for the contribution (download, compute, upload).
 * @property {number} verificationComputationTime - the amount of time spent for the verification of the contribution.
 * @property {string} zkeyIndex - the index of the contribution.
 * @property {ContributionFiles} files - the references and hashes of the artifacts produced during the contribution (and verification).
 * @property {ContributionVerificationSoftware} verificationSoftware - the info about the verification software used to verify the contributions.
 * @property {boolean} valid - true if the contribution has been evaluated as valid; otherwise false.
 * @property {number} lastUpdated - the timestamp where the last update of the Firestore document has happened.
 * @property {BeaconInfo} beacon - the data about the value used to compute the final contribution while finalizing the ceremony (final contribution only).
 */
export type ContributionDocument = {
    participantId: string
    contributionComputationTime: number
    verificationComputationTime: number
    zkeyIndex: string
    files: ContributionFiles
    verificationSoftware: ContributionVerificationSoftware
    valid: boolean
    lastUpdated: number
    beacon?: BeaconInfo
}

/**
 * Define a circuit document reference and data.
 * @dev must be used for generating fake/mock documents when testing.
 * @typedef {Object} CircuitDocumentReferenceAndData
 * @property {string} uid - the unique identifier of the document.
 * @property {CircuitDocument} doc - the info about the circuit document.
 */
export type CircuitDocumentReferenceAndData = {
    uid: string
    data: CircuitDocument
}

/**
 * Define a user document reference and data.
 * @dev must be used for generating fake/mock documents when testing.
 * @typedef {Object} UserDocumentReferenceAndData
 * @property {string} uid - the unique identifier of the document.
 * @property {UserDocument} doc - the info about the user document.
 */
export type UserDocumentReferenceAndData = {
    uid: string
    data: UserDocument
}

/**
 * Define a ceremony document reference and data.
 * @dev must be used for generating fake/mock documents when testing.
 * @typedef {Object} CeremonyDocumentReferenceAndData
 * @property {string} uid - the unique identifier of the document.
 * @property {CeremonyDocument} doc - the info about the user document.
 */
export type CeremonyDocumentReferenceAndData = {
    uid: string
    data: CeremonyDocument
}

/**
 * Define a participant document reference and data.
 * @dev must be used for generating fake/mock documents when testing.
 * @typedef {Object} ParticipantDocumentReferenceAndData
 * @property {string} uid - the unique identifier of the document.
 * @property {ParticipantDocument} doc - the info about the user document.
 */
export type ParticipantDocumentReferenceAndData = {
    uid: string
    data: ParticipantDocument
}

/**
 * Define a ceremony artifacts with their local paths.
 * @typedef {Object} CeremonyArtifacts
 * @property {string} circuitPrefix - the prefix of the circuit.
 * @property {string} circuitId - the unique identifier of the circuit.
 * @property {string} directoryRoot - the root directory of the ceremony.
 * @property {string} potLocalFilePath - the local path of the pot file.
 * @property {string} r1csLocalFilePath - the local path of the r1cs file.
 * @property {string} finalZkeyLocalFilePath - the local path of the final zKey file.
 * @property {string} lastZkeyLocalFilePath - the local path of the last zKey file.
 * @property {string} verifierLocalFilePath - the local path of the verifier file.
 * @property {string} verificationKeyLocalFilePath - the local path of the verification key file.
 * @property {string} wasmLocalFilePath - the local path of the wasm file.
 * @dev must be used for generating fake/mock documents when testing.
 */
export type CeremonyArtifacts = {
    circuitPrefix: string
    circuitId: string
    directoryRoot: string
    potLocalFilePath: string
    r1csLocalFilePath: string
    finalZkeyLocalFilePath: string
    lastZkeyLocalFilePath: string
    verifierLocalFilePath: string
    verificationKeyLocalFilePath: string
    wasmLocalFilePath: string
}

/**
 * Define a contribution document reference and data.
 * @dev must be used for generating fake/mock documents when testing.
 * @typedef {Object} ContributionDocumentReferenceAndData
 * @property {string} uid - the unique identifier of the document.
 * @property {ContributionDocument} doc - the info about the contribution document.
 */
export type ContributionDocumentReferenceAndData = {
    uid: string
    data: ContributionDocument
}

/**
 * Group the details for a VM EC2 instance.
 * @typedef {Object} EC2Instance
 * @property {string} instanceId - the unique identifier of the VM.
 * @property {string} imageId - the unique identifier of the image.
 * @property {string} instanceType - the VM type.
 * @property {string} keyName - the name of the key.
 * @property {string} launchTime - the timestamp of the launch of the VM.
 */
export type EC2Instance = {
    instanceId: string
    imageId: string
    instanceType: string
    keyName: string
    launchTime: string
}

/**
 * Group the information of a Virtual Machine configuration type.
 * @typedef {Object} VMConfigurationType
 * @property {string} type - the name of the instance type (e.g., t3.small).
 * @property {string} ram - the amount of RAM.
 * @property {string} vcpu - the number of VCPUs.
 */
export type VMConfigurationType = {
    type: string
    ram: number
    vcpu: number
}

/**
 * Group the information required to setup a new ceremony
 * @typedef {Object} SetupCeremonyData
 * @property {CeremonyInputData} - the details of the ceremony
 * @property {string} - the ceremony prefix
 * @property {Array<CircuitDocument>} - the details of the circuits
 * @property {Array<CeremonyArtifacts>} - the details of the ceremony artifacts
 */
export type SetupCeremonyData = {
    ceremonyInputData: CeremonyInputData
    ceremonyPrefix: string
    circuits: Array<CircuitDocument>
    circuitArtifacts: Array<CeremonySetupTemplateCircuitArtifacts>
}

export type CeremonySetupTemplateCircuitArtifacts = {
    artifacts: {
        bucket: string
        region: string
        r1csStoragePath: string
        wasmStoragePath: string
    }
}

export type CeremonySetupTemplateCircuitTimeout = {
    dynamicThreshold: number
    fixedTimeWindow: number
}

export type CeremonySetupTemplateCircuitName = {
    name: string
}

export type CeremonySetupTemplate = {
    title: string
    description: string
    startDate: string
    endDate: string
    timeoutMechanismType: CeremonyTimeoutType
    penalty: number
    circuits: Array<
        CircuitDocument &
            CeremonySetupTemplateCircuitArtifacts &
            CeremonySetupTemplateCircuitTimeout &
            CeremonySetupTemplateCircuitName
    >
}
