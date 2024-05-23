import { Inject, Injectable, forwardRef } from "@nestjs/common"
import { CeremonyDto } from "../dto/ceremony-dto"
import { InjectModel } from "@nestjs/sequelize"
import { CeremonyEntity } from "../entities/ceremony.entity"
import {
    CeremonyState,
    CircuitContributionVerificationMechanism,
    getBucketName,
    terminateEC2Instance
} from "@p0tion/actions"
import { createEC2Client, getFinalContribution } from "src/lib/utils"
import { SPECIFIC_ERRORS, logAndThrowError, printLog } from "src/lib/errors"
import { LogLevel } from "src/types/enums"
import { Cron, CronExpression } from "@nestjs/schedule"
import { Op } from "sequelize"
import { CircuitsService } from "src/circuits/service/circuits.service"
import { CircuitEntity } from "src/circuits/entities/circuit.entity"

@Injectable()
export class CeremoniesService {
    constructor(
        @InjectModel(CeremonyEntity)
        private ceremonyModel: typeof CeremonyEntity,
        @Inject(forwardRef(() => CircuitsService))
        private readonly circuitsService: CircuitsService
    ) {}

    async create(ceremonyDto: CeremonyDto) {
        const { circuits, ...ceremonyData } = ceremonyDto

        const ceremony = await this.ceremonyModel.create(ceremonyData as any)

        const circuitEntities = await this.circuitsService.createCircuits(circuits, ceremony)
        await ceremony.$set("circuits", circuitEntities)

        printLog(`Setup completed for ceremony ${ceremony.id}`, LogLevel.DEBUG)
        return ceremony
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
