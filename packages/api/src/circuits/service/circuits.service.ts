import fs from "fs"
import { Inject, Injectable, forwardRef } from "@nestjs/common"
import { InjectModel } from "@nestjs/sequelize"
import { CircuitEntity } from "../entities/circuit.entity"
import {
    CeremonyState,
    CircuitContributionVerificationMechanism,
    ParticipantContributionStep,
    ParticipantStatus,
    blake512FromPath,
    checkIfRunning,
    computeDiskSizeForVM,
    computeSHA256ToHex,
    createCustomLoggerForFile,
    createEC2Client,
    createEC2Instance,
    finalContributionIndex,
    formatZkeyIndex,
    genesisZkeyIndex,
    getBucketName,
    getPotStorageFilePath,
    getTranscriptStorageFilePath,
    getVerificationKeyStorageFilePath,
    getVerifierContractStorageFilePath,
    getZkeyStorageFilePath,
    retrieveCommandOutput,
    retrieveCommandStatus,
    runCommandUsingSSM,
    startEC2Instance,
    stopEC2Instance,
    verificationKeyAcronym,
    verifierSmartContractAcronym,
    vmBootstrapCommand,
    vmBootstrapScriptFilename,
    vmContributionVerificationCommand,
    vmDependenciesAndCacheArtifactsCommand
} from "@p0tion/actions"
import { CircuitDto, FinalizeCircuitData, WaitingQueueDto } from "../dto/circuits-dto"
import { CeremonyEntity } from "../../ceremonies/entities/ceremony.entity"
import {
    createSSMClient,
    createTemporaryLocalPath,
    deleteObject,
    downloadArtifactFromS3Bucket,
    getAWSVariables,
    sleep,
    uploadFileToBucket,
    uploadFileToBucketNoFile
} from "../../lib/utils"
import { COMMON_ERRORS, SPECIFIC_ERRORS, logAndThrowError, printLog } from "src/lib/errors"
import { LogLevel } from "src/types/enums"
import { CeremoniesService } from "src/ceremonies/service/ceremonies.service"
import { ContributionEntity } from "../entities/contribution.entity"
import { VerifyContributionData } from "../dto/contribution-dto"
import { Timer } from "timer-node"
import { ParticipantsService } from "src/participants/service/participants.service"
import { zKey } from "snarkjs"
import { EC2Client } from "@aws-sdk/client-ec2"
import { CommandInvocationStatus, SSMClient } from "@aws-sdk/client-ssm"
import { Contribution } from "src/participants/entities/participant.entity"
import { Sequelize } from "sequelize-typescript"
import { Cron, CronExpression } from "@nestjs/schedule"

@Injectable()
export class CircuitsService {
    constructor(
        private sequelize: Sequelize,
        @InjectModel(CircuitEntity)
        private circuitModel: typeof CircuitEntity,
        @InjectModel(ContributionEntity)
        private contributionModel: typeof ContributionEntity,
        @Inject(forwardRef(() => CeremoniesService))
        private readonly ceremoniesService: CeremoniesService,
        @Inject(forwardRef(() => ParticipantsService))
        private readonly participantsService: ParticipantsService
    ) {}

    async createCircuits(circuits: CircuitDto[], ceremony: CeremonyEntity) {
        const bucketName = getBucketName(ceremony.prefix, String(process.env.AWS_CEREMONY_BUCKET_POSTFIX))
        const ceremonyId = ceremony.id

        const circuitEntities: CircuitEntity[] = []
        for (let i = 0, ni = circuits.length; i < ni; i++) {
            let circuit = circuits[i]
            // create the waiting queue object
            circuit = {
                ...circuit,
                waitingQueue: {
                    contributors: [],
                    currentContributor: "",
                    completedContributions: 0,
                    failedContributions: 0
                }
            }
            // create VMs outside this server if the option was selected
            if (circuit.verification.cfOrVm === CircuitContributionVerificationMechanism.VM) {
                const { instance, vmDiskSize } = await this.setupAWSEnvironment(circuit, bucketName)
                // Update the circuit document info accordingly.
                circuit = {
                    ...circuit,
                    verification: {
                        cfOrVm: circuit.verification.cfOrVm,
                        vm: {
                            vmConfigurationType: circuit.verification.vm.vmConfigurationType,
                            vmInstanceId: instance.instanceId,
                            vmDiskSize
                        }
                    }
                }
            }
            const circuitEntity = await this.circuitModel.create({
                ...circuit,
                ceremonyId,
                waitingQueue: {
                    completedContributions: 0,
                    contributors: [],
                    currentContributor: "",
                    failedContributions: 0
                } as WaitingQueueDto
            })
            circuitEntities.push(circuitEntity)
        }
        return circuitEntities
    }

    async setupAWSEnvironment(circuit: CircuitDto, bucketName: string) {
        // VM command to be run at the startup.
        const startupCommand = vmBootstrapCommand(`${bucketName}/circuits/${circuit.name!}`)

        // Get EC2 client.
        const ec2Client = await createEC2Client()

        // Get AWS variables.
        const { snsTopic, region } = getAWSVariables()

        // Prepare dependencies and cache artifacts command.
        const vmCommands = vmDependenciesAndCacheArtifactsCommand(
            `${bucketName}/${circuit.files.initialZkeyStoragePath}`,
            `${bucketName}/${circuit.files.potStoragePath}`,
            snsTopic,
            region
        )

        printLog(`Check VM dependencies and cache artifacts commands ${vmCommands.join("\n")}`, LogLevel.DEBUG)
        // Upload the post-startup commands script file.
        printLog(`Uploading VM post-startup commands script file ${vmBootstrapScriptFilename}`, LogLevel.DEBUG)
        await uploadFileToBucketNoFile(
            bucketName,
            `circuits/${circuit.name!}/${vmBootstrapScriptFilename}`,
            vmCommands.join("\n")
        )
        // TODO: should we create a AWS instance or run it in a docker file?
        // Compute the VM disk space requirement (in GB).
        const vmDiskSize = computeDiskSizeForVM(circuit.zKeySizeInBytes, circuit.metadata.pot)

        printLog(`Check VM startup commands ${startupCommand.join("\n")}`, LogLevel.DEBUG)

        // Configure and instantiate a new VM based on the coordinator input.
        const instance = await createEC2Instance(
            ec2Client,
            startupCommand,
            circuit.verification.vm.vmConfigurationType,
            vmDiskSize,
            circuit.verification.vm.vmDiskType
        )
        return { instance, vmDiskSize }
    }

    async getCircuitsOfCeremony(ceremonyId: number) {
        return this.circuitModel.findAll({ where: { ceremonyId } })
    }

    async getCircuitContributionsFromParticipant(ceremonyId: number, circuitId: number, userId: string) {
        const contributions = await this.contributionModel.findAll({
            where: { participantUserId: userId, participantCeremonyId: ceremonyId, circuitId: circuitId }
        })
        return { contributions }
    }

    async getCircuitById(ceremonyId: number, circuitId: number) {
        const circuit = await this.circuitModel.findOne({ where: { ceremonyId, id: circuitId } })
        return { circuit }
    }

    async getContributionById(ceremonyId: number, circuitId: number, contributionId: number) {
        const contribution = await this.contributionModel.findOne({
            where: { participantCeremonyId: ceremonyId, circuitId, id: contributionId }
        })
        return { contribution }
    }

    async getContributionsFromCircuit(ceremonyId: number, circuitId: number) {
        const contributions = await this.contributionModel.findAll({
            where: { participantCeremonyId: ceremonyId, circuitId }
        })
        return { contributions }
    }

    async getFinalContributionFromCircuit(ceremonyId: number, circuitId: number) {
        const contribution = await this.contributionModel.findOne({
            where: { participantCeremonyId: ceremonyId, circuitId, zkeyIndex: finalContributionIndex }
        })
        return contribution
    }

    async finalizeCircuit(ceremonyId: number, userId: string, data: FinalizeCircuitData) {
        const { circuitId, beacon } = data
        const bucketName = await this.ceremoniesService.getBucketNameOfCeremony(ceremonyId)

        const circuit = await this.circuitModel.findByPk(circuitId)
        if (!circuit) {
            return
        }
        // Extract data.
        const { prefix } = circuit
        // Prepare filenames and storage paths.
        const verificationKeyFilename = `${prefix}_${verificationKeyAcronym}.json`
        const verifierContractFilename = `${prefix}_${verifierSmartContractAcronym}.sol`
        const verificationKeyStorageFilePath = getVerificationKeyStorageFilePath(prefix, verificationKeyFilename)
        const verifierContractStorageFilePath = getVerifierContractStorageFilePath(prefix, verifierContractFilename)

        // Prepare temporary paths.
        const verificationKeyTemporaryFilePath = createTemporaryLocalPath(verificationKeyFilename)
        const verifierContractTemporaryFilePath = createTemporaryLocalPath(verifierContractFilename)

        // Download artifact from ceremony bucket.
        await downloadArtifactFromS3Bucket(bucketName, verificationKeyStorageFilePath, verificationKeyTemporaryFilePath)
        await downloadArtifactFromS3Bucket(
            bucketName,
            verifierContractStorageFilePath,
            verifierContractTemporaryFilePath
        )

        // Compute hash before unlink.
        const verificationKeyBlake2bHash = await blake512FromPath(verificationKeyTemporaryFilePath)
        const verifierContractBlake2bHash = await blake512FromPath(verifierContractTemporaryFilePath)

        // Add references and hashes of the final contribution artifacts.
        const contribution = await this.contributionModel.findOne({
            where: { participantUserId: userId, participantCeremonyId: ceremonyId }
        })
        if (!contribution) {
            logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)
        }
        await contribution.update({
            files: {
                ...contribution.files,
                verificationKeyBlake2bHash,
                verificationKeyFilename,
                verificationKeyStoragePath: verificationKeyStorageFilePath,
                verifierContractBlake2bHash,
                verifierContractFilename,
                verifierContractStoragePath: verifierContractStorageFilePath
            },
            beacon: {
                value: beacon,
                hash: computeSHA256ToHex(beacon)
            }
        })

        printLog(
            `Circuit ${circuitId} finalization completed - Ceremony ${ceremonyId} - Coordinator ${userId}`,
            LogLevel.DEBUG
        )
    }

    async waitForVMCommandExecution(ssm: SSMClient, vmInstanceId: string, commandId: string) {
        return new Promise<void>((resolve, reject) => {
            const poll = async () => {
                try {
                    // Get command status.
                    const cmdStatus = await retrieveCommandStatus(ssm, vmInstanceId, commandId)
                    printLog(`Checking command ${commandId} status => ${cmdStatus}`, LogLevel.DEBUG)

                    let error: any
                    switch (cmdStatus) {
                        case CommandInvocationStatus.CANCELLING:
                        case CommandInvocationStatus.CANCELLED: {
                            error = SPECIFIC_ERRORS.SE_VM_CANCELLED_COMMAND_EXECUTION
                            break
                        }
                        case CommandInvocationStatus.DELAYED: {
                            error = SPECIFIC_ERRORS.SE_VM_DELAYED_COMMAND_EXECUTION
                            break
                        }
                        case CommandInvocationStatus.FAILED: {
                            error = SPECIFIC_ERRORS.SE_VM_FAILED_COMMAND_EXECUTION
                            break
                        }
                        case CommandInvocationStatus.TIMED_OUT: {
                            error = SPECIFIC_ERRORS.SE_VM_TIMEDOUT_COMMAND_EXECUTION
                            break
                        }
                        case CommandInvocationStatus.IN_PROGRESS:
                        case CommandInvocationStatus.PENDING: {
                            // wait a minute and poll again
                            setTimeout(poll, 60000)
                            return
                        }
                        case CommandInvocationStatus.SUCCESS: {
                            printLog(`Command ${commandId} successfully completed`, LogLevel.DEBUG)

                            // Resolve the promise.
                            resolve()
                            return
                        }
                        default: {
                            logAndThrowError(SPECIFIC_ERRORS.SE_VM_UNKNOWN_COMMAND_STATUS)
                        }
                    }

                    if (error) {
                        logAndThrowError(error)
                    }
                } catch (error: any) {
                    printLog(`Invalid command ${commandId} execution`, LogLevel.DEBUG)

                    const ec2 = await createEC2Client()

                    // if it errors out, let's just log it as a warning so the coordinator is aware
                    try {
                        await stopEC2Instance(ec2, vmInstanceId)
                    } catch (error: any) {
                        printLog(`Error while stopping VM instance ${vmInstanceId} - Error ${error}`, LogLevel.WARN)
                    }

                    if (!error.toString().includes(commandId))
                        logAndThrowError(COMMON_ERRORS.CM_INVALID_COMMAND_EXECUTION)

                    // Reject the promise.
                    reject()
                }
            }

            setTimeout(poll, 60000)
        })
    }

    async checkIfVMRunning(ec2: EC2Client, vmInstanceId: string, attempts = 5) {
        // if we tried 5 times, then throw an error
        if (attempts <= 0) logAndThrowError(SPECIFIC_ERRORS.SE_VM_NOT_RUNNING)

        await sleep(60000) // Wait for 1 min
        const isVMRunning = await checkIfRunning(ec2 as any, vmInstanceId)

        if (!isVMRunning) {
            printLog(`VM not running, ${attempts - 1} attempts remaining. Retrying in 1 minute...`, LogLevel.DEBUG)
            return this.checkIfVMRunning(ec2, vmInstanceId, attempts - 1)
        }
        return true
    }

    async verifyContribution(ceremonyId: number, userId: string, data: VerifyContributionData) {
        // Extract data.
        const { circuitId, contributorOrCoordinatorIdentifier } = data
        const bucketName = await this.ceremoniesService.getBucketNameOfCeremony(ceremonyId)
        const ceremony = await this.ceremoniesService.findById(ceremonyId)
        const participant = await this.participantsService.findParticipantOfCeremony(userId, ceremonyId)
        const circuit = await this.circuitModel.findByPk(circuitId)
        if (!circuit) {
            logAndThrowError(COMMON_ERRORS.CM_INEXISTENT_DOCUMENT_DATA)
        }

        // Step (0).

        // Prepare and start timer.
        const verifyContributionTimer = new Timer({ label: "verify-contribution" })
        verifyContributionTimer.start()

        // Extract documents data.
        const { state } = ceremony
        const { status, contributions, verificationStartedAt, contributionStartedAt } = participant
        const { waitingQueue, prefix, avgTimings, verification, files } = circuit
        const { completedContributions, failedContributions } = waitingQueue
        const {
            contributionComputation: avgContributionComputationTime,
            fullContribution: avgFullContributionTime,
            verifyCloudFunction: avgVerifyCloudFunctionTime
        } = avgTimings
        const { cfOrVm, vm } = verification
        // we might not have it if the circuit is not using VM.
        let vmInstanceId: string = ""
        if (vm) vmInstanceId = vm.vmInstanceId

        // Define pre-conditions.
        const { isCoordinator } = await this.ceremoniesService.isCoordinator(userId, ceremonyId)
        const isFinalizing = state === CeremonyState.CLOSED && !!isCoordinator // true only when the coordinator verifies the final contributions.
        const isContributing = status === ParticipantStatus.CONTRIBUTING
        const isUsingVM = cfOrVm === CircuitContributionVerificationMechanism.VM && !!vmInstanceId

        // Prepare state.
        let isContributionValid = false
        let verifyCloudFunctionExecutionTime = 0 // time spent while executing the verify contribution cloud function.
        let verifyCloudFunctionTime = 0 // time spent while executing the core business logic of this cloud function.
        let fullContributionTime = 0 // time spent while doing non-verification contributions tasks (download, compute, upload).
        let contributionComputationTime = 0 // time spent while computing the contribution.
        let lastZkeyBlake2bHash: string = "" // the Blake2B hash of the last zKey.
        let verificationTranscriptTemporaryLocalPath: string = "" // the local temporary path for the verification transcript.
        let transcriptBlake2bHash: string = "" // the Blake2B hash of the verification transcript.
        let commandId: string = "" // the unique identifier of the VM command.

        // Derive necessary data.
        const lastZkeyIndex = formatZkeyIndex(completedContributions + 1)
        const verificationTranscriptCompleteFilename = `${prefix}_${
            isFinalizing
                ? `${contributorOrCoordinatorIdentifier}_${finalContributionIndex}_verification_transcript.log`
                : `${lastZkeyIndex}_${contributorOrCoordinatorIdentifier}_verification_transcript.log`
        }`

        const lastZkeyFilename = `${prefix}_${isFinalizing ? finalContributionIndex : lastZkeyIndex}.zkey`

        // Prepare state for VM verification (if needed).
        const ec2 = await createEC2Client()
        const ssm = await createSSMClient()

        // Step (1.A.1).
        // Get storage paths.
        const verificationTranscriptStoragePathAndFilename = getTranscriptStorageFilePath(
            prefix,
            verificationTranscriptCompleteFilename
        )
        // the zKey storage path is required to be sent to the VM api
        const lastZkeyStoragePath = getZkeyStorageFilePath(
            prefix,
            `${prefix}_${isFinalizing ? finalContributionIndex : lastZkeyIndex}.zkey`
        )

        const verificationTaskTimer = new Timer({ label: `${ceremonyId}-${circuitId}-${userId}` })

        const completeVerification = async () => {
            // Stop verification task timer.
            printLog("Completing verification", LogLevel.DEBUG)
            verificationTaskTimer.stop()
            verifyCloudFunctionExecutionTime = verificationTaskTimer.ms()

            if (isUsingVM) {
                // Create temporary path.
                verificationTranscriptTemporaryLocalPath = createTemporaryLocalPath(`${circuitId}_${userId}.log`)

                await sleep(1000) // wait 1s for file creation.

                // Download from bucket.
                // nb. the transcript MUST be uploaded from the VM by verification commands.
                await downloadArtifactFromS3Bucket(
                    bucketName,
                    verificationTranscriptStoragePathAndFilename,
                    verificationTranscriptTemporaryLocalPath
                )

                // Read the verification trascript and validate data by checking for core info ("ZKey Ok!").
                const content = fs.readFileSync(verificationTranscriptTemporaryLocalPath, "utf-8")

                if (content.includes("ZKey Ok!")) isContributionValid = true

                // If the contribution is valid, then format and store the trascript.
                if (isContributionValid) {
                    // eslint-disable-next-line no-control-regex
                    const updated = content.replace(/\x1b[[0-9;]*m/g, "")

                    fs.writeFileSync(verificationTranscriptTemporaryLocalPath, updated)
                }
            }

            printLog(`The contribution has been verified - Result ${isContributionValid}`, LogLevel.DEBUG)

            // TODO: make a batch transaction to not have any errors
            // Step (1.A.4).
            if (isContributionValid) {
                // Sleep ~3 seconds to wait for verification transcription.
                await sleep(3000)

                // Step (1.A.4.A.1).
                if (isUsingVM) {
                    // Retrieve the contribution hash from the command output.
                    lastZkeyBlake2bHash = await retrieveCommandOutput(ssm, vmInstanceId, commandId)

                    const hashRegex = /[a-fA-F0-9]{64}/
                    const match = lastZkeyBlake2bHash.match(hashRegex)!

                    lastZkeyBlake2bHash = match.at(0)!

                    // re upload the formatted verification transcript
                    await uploadFileToBucket(
                        bucketName,
                        verificationTranscriptStoragePathAndFilename,
                        verificationTranscriptTemporaryLocalPath,
                        true
                    )
                } else {
                    // Upload verification transcript.
                    /// nb. do not use multi-part upload here due to small file size.
                    await uploadFileToBucket(
                        bucketName,
                        verificationTranscriptStoragePathAndFilename,
                        verificationTranscriptTemporaryLocalPath,
                        true
                    )
                }

                // Compute verification transcript hash.
                transcriptBlake2bHash = await blake512FromPath(verificationTranscriptTemporaryLocalPath)

                // Free resources by unlinking transcript temporary file.
                fs.unlinkSync(verificationTranscriptTemporaryLocalPath)

                // Filter participant contributions to find the data related to the one verified.
                // it should have hash, computation time but no id
                const participantContributions = contributions.filter(
                    (contribution: Contribution) =>
                        !!contribution.hash && !!contribution.computationTime && !contribution.id
                )

                /// @dev (there must be only one contribution with an empty 'doc' field).
                if (participantContributions.length !== 1)
                    logAndThrowError(SPECIFIC_ERRORS.SE_VERIFICATION_NO_PARTICIPANT_CONTRIBUTION_DATA)

                // Get contribution computation time.
                contributionComputationTime = contributions.at(0).computationTime

                // Step (1.A.4.A.2).
                const contribution = await this.contributionModel.create({
                    participantUserId: userId,
                    participantCeremonyId: ceremonyId,
                    circuitId: circuitId,
                    contributionComputationTime,
                    verificationComputationTime: verifyCloudFunctionExecutionTime,
                    zkeyIndex: isFinalizing ? finalContributionIndex : lastZkeyIndex,
                    files: {
                        transcriptFilename: verificationTranscriptCompleteFilename,
                        lastZkeyFilename,
                        transcriptStoragePath: verificationTranscriptStoragePathAndFilename,
                        lastZkeyStoragePath,
                        transcriptBlake2bHash,
                        lastZkeyBlake2bHash
                    },
                    verificationSoftware: {
                        name: String(process.env.CUSTOM_CONTRIBUTION_VERIFICATION_SOFTWARE_NAME),
                        version: String(process.env.CUSTOM_CONTRIBUTION_VERIFICATION_SOFTWARE_VERSION),
                        commitHash: String(process.env.CUSTOM_CONTRIBUTION_VERIFICATION_SOFTWARE_COMMIT_HASH)
                    },
                    valid: isContributionValid
                })
                await this.refreshParticipantAfterContributionVerification(contribution)

                verifyContributionTimer.stop()
                verifyCloudFunctionTime = verifyContributionTimer.ms()
            } else {
                // Step (1.A.4.B).

                // Free-up storage by deleting invalid contribution.
                await deleteObject(bucketName, lastZkeyStoragePath)

                // Step (1.A.4.B.1).
                const contribution = await this.contributionModel.create({
                    participantUserId: userId,
                    participantCeremonyId: ceremonyId,
                    circuitId: circuitId,
                    verificationComputationTime: verifyCloudFunctionExecutionTime,
                    zkeyIndex: isFinalizing ? finalContributionIndex : lastZkeyIndex,
                    verificationSoftware: {
                        name: String(process.env.CUSTOM_CONTRIBUTION_VERIFICATION_SOFTWARE_NAME),
                        version: String(process.env.CUSTOM_CONTRIBUTION_VERIFICATION_SOFTWARE_VERSION),
                        commitHash: String(process.env.CUSTOM_CONTRIBUTION_VERIFICATION_SOFTWARE_COMMIT_HASH)
                    },
                    valid: isContributionValid
                })
                await this.refreshParticipantAfterContributionVerification(contribution)
            }

            // Stop VM instance
            if (isUsingVM) {
                // using try and catch as the VM stopping function can throw
                // however we want to continue without stopping as the
                // verification was valid, and inform the coordinator
                try {
                    await stopEC2Instance(ec2, vmInstanceId)
                } catch (error: any) {
                    printLog(`Error while stopping VM instance ${vmInstanceId} - Error ${error}`, LogLevel.WARN)
                }
            }
            // Step (1.A.4.C)
            if (!isFinalizing) {
                // Step (1.A.4.C.1)
                // Compute new average contribution/verification time.
                fullContributionTime = Number(verificationStartedAt) - Number(contributionStartedAt)

                const newAvgContributionComputationTime =
                    avgContributionComputationTime > 0
                        ? (avgContributionComputationTime + contributionComputationTime) / 2
                        : contributionComputationTime
                const newAvgFullContributionTime =
                    avgFullContributionTime > 0
                        ? (avgFullContributionTime + fullContributionTime) / 2
                        : fullContributionTime
                const newAvgVerifyCloudFunctionTime =
                    avgVerifyCloudFunctionTime > 0
                        ? (avgVerifyCloudFunctionTime + verifyCloudFunctionTime) / 2
                        : verifyCloudFunctionTime

                // Prepare tx to update circuit average contribution/verification time.
                const updatedCircuit = await this.circuitModel.findByPk(circuitId)
                const { waitingQueue: updatedWaitingQueue } = updatedCircuit

                /// @dev this must happen only for valid contributions.
                updatedCircuit.update({
                    avgTimings: {
                        contributionComputation: isContributionValid
                            ? newAvgContributionComputationTime
                            : avgContributionComputationTime,
                        fullContribution: isContributionValid ? newAvgFullContributionTime : avgFullContributionTime,
                        verifyCloudFunction: isContributionValid
                            ? newAvgVerifyCloudFunctionTime
                            : avgVerifyCloudFunctionTime
                    },
                    waitingQueue: {
                        ...updatedWaitingQueue,
                        completedContributions: isContributionValid
                            ? completedContributions + 1
                            : completedContributions,
                        failedContributions: isContributionValid ? failedContributions : failedContributions + 1
                    }
                })
            }

            printLog(
                `The contribution #${
                    isFinalizing ? finalContributionIndex : lastZkeyIndex
                } of circuit ${circuitId} (ceremony ${ceremonyId}) has been verified as ${
                    isContributionValid ? "valid" : "invalid"
                } for the participant ${userId}`,
                LogLevel.DEBUG
            )
        }

        // Step (1).
        if (isContributing || isFinalizing) {
            // Prepare timer.
            verificationTaskTimer.start()

            // Step (1.A.3.0).
            if (isUsingVM) {
                printLog(`Starting the VM mechanism`, LogLevel.DEBUG)

                // Prepare for VM execution.
                let isVMRunning = false // true when the VM is up, otherwise false.

                // Step (1.A.3.1).
                await startEC2Instance(ec2, vmInstanceId)

                await sleep(60000) // nb. wait for VM startup (1 mins + retry).

                // Check if the startup is running.
                isVMRunning = await this.checkIfVMRunning(ec2 as any, vmInstanceId)

                printLog(`VM running: ${isVMRunning}`, LogLevel.DEBUG)

                // Step (1.A.3.2).
                // Prepare.
                const verificationCommand = vmContributionVerificationCommand(
                    bucketName,
                    lastZkeyStoragePath,
                    verificationTranscriptStoragePathAndFilename
                )

                // Run.
                commandId = await runCommandUsingSSM(ssm, vmInstanceId, verificationCommand)

                printLog(`Starting the execution of command ${commandId}`, LogLevel.DEBUG)

                // Step (1.A.3.3).
                return this.waitForVMCommandExecution(ssm, vmInstanceId, commandId)
                    .then(async () => {
                        // Command execution successfully completed.
                        printLog(`Command ${commandId} execution has been successfully completed`, LogLevel.DEBUG)
                        await completeVerification()
                    })
                    .catch((error: any) => {
                        // Command execution aborted.
                        printLog(`Command ${commandId} execution has been aborted - Error ${error}`, LogLevel.DEBUG)

                        logAndThrowError(COMMON_ERRORS.CM_INVALID_COMMAND_EXECUTION)
                    })
            }

            // CF approach.
            printLog(`CF mechanism`, LogLevel.DEBUG)

            const potStoragePath = getPotStorageFilePath(files.potFilename)
            const firstZkeyStoragePath = getZkeyStorageFilePath(prefix, `${prefix}_${genesisZkeyIndex}.zkey`)
            // Prepare temporary file paths.
            // (nb. these are needed to download the necessary artifacts for verification from AWS S3).
            verificationTranscriptTemporaryLocalPath = createTemporaryLocalPath(verificationTranscriptCompleteFilename)
            const potTempFilePath = createTemporaryLocalPath(`${circuitId}_${userId}.pot`)
            const firstZkeyTempFilePath = createTemporaryLocalPath(`${circuitId}_${userId}_genesis.zkey`)
            const lastZkeyTempFilePath = createTemporaryLocalPath(`${circuitId}_${userId}_last.zkey`)

            // Create and populate transcript.
            const transcriptLogger = createCustomLoggerForFile(verificationTranscriptTemporaryLocalPath)
            transcriptLogger.info(
                `${
                    isFinalizing ? `Final verification` : `Verification`
                } transcript for ${prefix} circuit Phase 2 contribution.\n${
                    isFinalizing ? `Coordinator ` : `Contributor # ${Number(lastZkeyIndex)}`
                } (${contributorOrCoordinatorIdentifier})\n`
            )

            // Step (1.A.2).
            await downloadArtifactFromS3Bucket(bucketName, potStoragePath, potTempFilePath)
            await downloadArtifactFromS3Bucket(bucketName, firstZkeyStoragePath, firstZkeyTempFilePath)
            await downloadArtifactFromS3Bucket(bucketName, lastZkeyStoragePath, lastZkeyTempFilePath)

            // Step (1.A.4).
            isContributionValid = await zKey.verifyFromInit(
                firstZkeyTempFilePath,
                potTempFilePath,
                lastZkeyTempFilePath,
                transcriptLogger
            )

            // Compute contribution hash.
            lastZkeyBlake2bHash = await blake512FromPath(lastZkeyTempFilePath)

            // Free resources by unlinking temporary folders.
            // Do not free-up verification transcript path here.
            try {
                fs.unlinkSync(potTempFilePath)
                fs.unlinkSync(firstZkeyTempFilePath)
                fs.unlinkSync(lastZkeyTempFilePath)
            } catch (error: any) {
                printLog(`Error while unlinking temporary files - Error ${error}`, LogLevel.WARN)
            }

            await completeVerification()
        }
        return { result: true }
    }

    //@Cron(CronExpression.EVERY_30_SECONDS)
    async refreshParticipantAfterContributionVerification(createdContribution: ContributionEntity) {
        const { participantUserId } = createdContribution
        const ceremonyId = createdContribution.participantCeremonyId

        const circuits = await this.getCircuitsOfCeremony(ceremonyId)
        const participant = await this.participantsService.findParticipantOfCeremony(participantUserId, ceremonyId)

        // Extract data.
        const { contributions, status, contributionProgress } = participant

        // Define pre-conditions.
        const isFinalizing = status === ParticipantStatus.FINALIZING

        // Link the newest created contribution document w/ participant contributions info.
        // nb. there must be only one contribution with an empty doc.
        let newContributions = [] as Contribution[]
        if (contributions) {
            newContributions = contributions.map((contribution) => {
                if (!contribution.id) {
                    return { ...contribution, id: createdContribution.id }
                }
                return contribution
            })
        }

        try {
            await this.sequelize.transaction(async (t) => {
                const transactionHost = { transaction: t }
                if (!isFinalizing) {
                    await participant.update(
                        {
                            // - DONE = provided a contribution for every circuit
                            // - CONTRIBUTED = some contribution still missing.
                            status:
                                contributionProgress + 1 > circuits.length
                                    ? ParticipantStatus.DONE
                                    : ParticipantStatus.CONTRIBUTED,
                            contributionStep: ParticipantContributionStep.COMPLETED,
                            tempContributionData: null
                        },
                        transactionHost
                    )
                }

                await participant.update({ contributions: newContributions }, transactionHost)

                printLog(
                    `Participant ${participant.userId} refreshed after contribution ${createdContribution.id} - The participant was finalizing the ceremony ${isFinalizing}`,
                    LogLevel.DEBUG
                )
            })
        } catch (error) {
            printLog(
                `There was an error running the coordinate function with participant ${participant.userId} in ceremony: ${ceremonyId}`,
                LogLevel.DEBUG
            )
        }
    }
}
