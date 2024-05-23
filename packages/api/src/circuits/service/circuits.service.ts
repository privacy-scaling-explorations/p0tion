import { Inject, Injectable, forwardRef } from "@nestjs/common"
import { InjectModel } from "@nestjs/sequelize"
import { CircuitEntity } from "../entities/circuit.entity"
import {
    CircuitContributionVerificationMechanism,
    blake512FromPath,
    computeDiskSizeForVM,
    computeSHA256ToHex,
    createEC2Client,
    createEC2Instance,
    getBucketName,
    getVerificationKeyStorageFilePath,
    getVerifierContractStorageFilePath,
    verificationKeyAcronym,
    verifierSmartContractAcronym,
    vmBootstrapCommand,
    vmBootstrapScriptFilename,
    vmDependenciesAndCacheArtifactsCommand
} from "@p0tion/actions"
import { CircuitDto, FinalizeCircuitData } from "../dto/circuits-dto"
import { CeremonyEntity } from "src/ceremonies/entities/ceremony.entity"
import {
    createTemporaryLocalPath,
    downloadArtifactFromS3Bucket,
    getAWSVariables,
    uploadFileToBucketNoFile
} from "src/lib/utils"
import { COMMON_ERRORS, logAndThrowError, printLog } from "src/lib/errors"
import { LogLevel } from "src/types/enums"
import { CeremoniesService } from "src/ceremonies/service/ceremonies.service"
import { ContributionEntity } from "../entities/contribution.entity"

@Injectable()
export class CircuitsService {
    constructor(
        @InjectModel(CircuitEntity)
        private circuitModel: typeof CircuitEntity,
        @InjectModel(ContributionEntity)
        private contributionModel: typeof ContributionEntity,
        @Inject(forwardRef(() => CeremoniesService))
        private readonly ceremoniesService: CeremoniesService
    ) {}

    async createCircuits(circuits: CircuitDto[], ceremony: CeremonyEntity) {
        const bucketName = getBucketName(ceremony.prefix, String(process.env.AWS_CEREMONY_BUCKET_POSTFIX))
        const ceremonyId = ceremony.id

        const circuitEntities = []
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
            const circuitEntity = await this.circuitModel.create({ ...circuit, ceremonyId })
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

    async finalizeCircuit(ceremonyId: number, userId: string, data: FinalizeCircuitData) {
        const { circuitId, beacon } = data
        const bucketName = await this.ceremoniesService.getBucketNameOfCeremony(ceremonyId)

        const circuit = await this.circuitModel.findByPk(circuitId)
        if (!circuit) {
            return
        }
        // Extract data.
        const { name } = circuit
        // Prepare filenames and storage paths.
        const verificationKeyFilename = `${name}_${verificationKeyAcronym}.json`
        const verifierContractFilename = `${name}_${verifierSmartContractAcronym}.sol`
        const verificationKeyStorageFilePath = getVerificationKeyStorageFilePath(name, verificationKeyFilename)
        const verifierContractStorageFilePath = getVerifierContractStorageFilePath(name, verifierContractFilename)

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
}
