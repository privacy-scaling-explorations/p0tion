import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/sequelize"
import { CircuitEntity } from "../entities/circuit.entity"
import {
    CircuitContributionVerificationMechanism,
    computeDiskSizeForVM,
    createEC2Client,
    createEC2Instance,
    getBucketName,
    vmBootstrapCommand,
    vmBootstrapScriptFilename,
    vmDependenciesAndCacheArtifactsCommand
} from "@p0tion/actions"
import { CircuitDto } from "../dto/circuits-dto"
import { CeremonyEntity } from "src/ceremonies/entities/ceremony.entity"
import { getAWSVariables, uploadFileToBucketNoFile } from "src/lib/utils"
import { printLog } from "src/lib/errors"
import { LogLevel } from "src/types/enums"

@Injectable()
export class CircuitsService {
    constructor(
        @InjectModel(CircuitEntity)
        private circuitModel: typeof CircuitEntity
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
}
