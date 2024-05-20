import { Injectable } from "@nestjs/common"
import { CeremonyDto } from "../dto/ceremony-dto"
import { InjectModel } from "@nestjs/sequelize"
import { CeremonyEntity } from "../entities/ceremony.entity"
import { CircuitEntity } from "../entities/circuit.entity"
import { CircuitDto } from "../dto/circuit-dto"
import {
    CeremonyState,
    CircuitContributionVerificationMechanism,
    computeDiskSizeForVM,
    createEC2Instance,
    getBucketName,
    terminateEC2Instance,
    vmBootstrapCommand,
    vmBootstrapScriptFilename,
    vmDependenciesAndCacheArtifactsCommand
} from "@p0tion/actions"
import { createEC2Client, getAWSVariables, getFinalContribution, uploadFileToBucketNoFile } from "src/lib/utils"
import { SPECIFIC_ERRORS, logAndThrowError, printLog } from "src/lib/errors"
import { LogLevel } from "src/types/enums"
import { Cron, CronExpression } from "@nestjs/schedule"
import { Op } from "sequelize"

@Injectable()
export class CeremoniesService {
    constructor(
        @InjectModel(CeremonyEntity)
        private ceremonyModel: typeof CeremonyEntity,
        @InjectModel(CircuitEntity)
        private circuitModel: typeof CircuitEntity
    ) {}

    async create(ceremonyDto: CeremonyDto) {
        const { circuits, ...ceremonyData } = ceremonyDto

        const ceremony = await this.ceremonyModel.create(ceremonyData as any)

        const circuitEntities = await this.createCircuits(circuits, ceremony)
        await ceremony.$set("circuits", circuitEntities)

        printLog(`Setup completed for ceremony ${ceremony.id}`, LogLevel.DEBUG)
        return ceremony
    }

    async createCircuits(circuits: CircuitDto[], ceremony: CeremonyEntity) {
        const bucketName = getBucketName(ceremony.prefix, String(process.env.AWS_CEREMONY_BUCKET_POSTFIX))
        const ceremonyId = ceremony.id

        const circuitEntities = []
        for (let i = 0, ni = circuits.length; i < ni; i++) {
            let circuit = circuits[i]
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

    findById(id: number) {
        return this.ceremonyModel.findByPk(id, { include: [CircuitEntity] })
    }

    findCoordinatorOfCeremony(userId: string, ceremonyId: number) {
        return this.ceremonyModel.findOne({ where: { id: ceremonyId, coordinatorId: userId } })
    }

    async getBucketNameOfCeremony(ceremonyId: number) {
        const ceremony = await this.ceremonyModel.findByPk(ceremonyId)
        const ceremonyPrefix = ceremony.prefix
        return getBucketName(ceremonyPrefix, String(process.env.AWS_CEREMONY_BUCKET_POSTFIX))
    }

    async finalizeCeremony(ceremonyId: number) {
        const ceremony = await this.findById(ceremonyId)
        const { circuits } = ceremony
        for await (const circuit of circuits) await getFinalContribution(ceremonyId, circuit.id)

        const { state } = ceremony
        // Pre-conditions: verify the ceremony is closed and coordinator is finalizing.
        if (state === CeremonyState.CLOSED) {
            // Update the ceremony state to FINALIZED.
            await ceremony.update({ state: CeremonyState.FINALIZED })
            // Check for VM termination (if any).
            for (const circuit of circuits) {
                const { verification } = circuit

                if (verification.cfOrVm === CircuitContributionVerificationMechanism.VM) {
                    // Prepare EC2 client.
                    const ec2Client = await createEC2Client()

                    const { vm } = verification

                    await terminateEC2Instance(ec2Client, vm.vmInstanceId)
                }
            }

            printLog(`Ceremony ${ceremony.id} correctly finalized`, LogLevel.INFO)
        } else logAndThrowError(SPECIFIC_ERRORS.SE_CEREMONY_CANNOT_FINALIZE_CEREMONY)
    }

    @Cron(CronExpression.EVERY_10_MINUTES)
    async startCeremony() {
        const scheduledCeremoniesUntilNow = await this.ceremonyModel.findAll({
            where: {
                state: CeremonyState.SCHEDULED,
                startDate: {
                    [Op.lte]: new Date()
                }
            }
        })
        scheduledCeremoniesUntilNow.forEach(async (ceremony) => {
            await ceremony.update({ state: CeremonyState.OPENED })
            printLog(`Ceremony ${ceremony.id} is now open`, LogLevel.DEBUG)
        })
    }

    @Cron(CronExpression.EVERY_10_MINUTES)
    async stopCeremony() {
        const openedCeremoniesUntilNow = await this.ceremonyModel.findAll({
            where: {
                state: CeremonyState.OPENED,
                endDate: {
                    [Op.lte]: new Date()
                }
            }
        })
        openedCeremoniesUntilNow.forEach(async (ceremony) => {
            await ceremony.update({ state: CeremonyState.CLOSED })
            printLog(`Ceremony ${ceremony.id} is now closed`, LogLevel.DEBUG)
        })
    }
}
