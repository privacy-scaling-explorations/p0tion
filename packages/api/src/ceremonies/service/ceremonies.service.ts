import { Inject, Injectable, forwardRef } from "@nestjs/common"
import { CeremonyDto, CreateCircuitsDto } from "../dto/ceremony-dto"
import { InjectModel } from "@nestjs/sequelize"
import { CeremonyEntity } from "../entities/ceremony.entity"
import {
    CeremonyState,
    CircuitContributionVerificationMechanism,
    getBucketName,
    terminateEC2Instance
} from "@p0tion/actions"
import { createEC2Client, getFinalContribution } from "../../lib/utils"
import { SPECIFIC_ERRORS, logAndThrowError, printLog } from "../../lib/errors"
import { LogLevel } from "../../types/enums"
import { Cron, CronExpression } from "@nestjs/schedule"
import { Op } from "sequelize"
import { CircuitsService } from "../../circuits/service/circuits.service"
import { CircuitEntity } from "../../circuits/entities/circuit.entity"
import { ParticipantEntity } from "../../participants/entities/participant.entity"

@Injectable()
export class CeremoniesService {
    constructor(
        @InjectModel(CeremonyEntity)
        private ceremonyModel: typeof CeremonyEntity,
        @Inject(forwardRef(() => CircuitsService))
        private readonly circuitsService: CircuitsService
    ) {}

    async create(ceremonyDto: CeremonyDto) {
        const { ...ceremonyData } = ceremonyDto

        const ceremony = await this.ceremonyModel.create(ceremonyData as any)

        printLog(`Setup completed for ceremony ${ceremony.id}`, LogLevel.DEBUG)
        return ceremony
    }

    async update(ceremonyId: number, coordinatorId: string, data: Partial<CeremonyEntity>) {
        data.id = ceremonyId
        await this.ceremonyModel.update(data, { where: { id: ceremonyId, coordinatorId } })
        return true
    }

    async createCircuits(ceremonyId: number, createCircuitsDto: CreateCircuitsDto) {
        const ceremony = await this.findById(ceremonyId)
        const { circuits } = createCircuitsDto
        const circuitEntities = await this.circuitsService.createCircuits(circuits, ceremony)
        await ceremony.$set("circuits", circuitEntities)

        printLog(`Circuits created for ceremony ${ceremony.id}`, LogLevel.DEBUG)
        return circuitEntities
    }

    async findAll() {
        const allCeremonies = await this.ceremonyModel.findAll({ include: [CircuitEntity, ParticipantEntity] })
        return { allCeremonies }
    }

    findById(id: number) {
        return this.ceremonyModel.findByPk(id, { include: [CircuitEntity, ParticipantEntity] })
    }

    async findOpened() {
        const openedCeremonies = await this.ceremonyModel.findAll({ where: { state: CeremonyState.OPENED } })
        return { openedCeremonies }
    }

    async findClosed() {
        const closedCeremonies = await this.ceremonyModel.findAll({ where: { state: CeremonyState.CLOSED } })
        return { closedCeremonies }
    }

    findCoordinatorOfCeremony(userId: string, ceremonyId: number) {
        return this.ceremonyModel.findOne({ where: { id: ceremonyId, coordinatorId: userId } })
    }

    async isCoordinator(userId: string, ceremonyId: number) {
        const isCoordinator = await this.findCoordinatorOfCeremony(userId, ceremonyId)
        return { isCoordinator: !!isCoordinator }
    }

    async getBucketNameOfCeremony(ceremonyId: number) {
        const ceremony = await this.ceremonyModel.findByPk(ceremonyId)
        const ceremonyPrefix = ceremony.prefix
        return getBucketName(ceremonyPrefix, String(process.env.AWS_CEREMONY_BUCKET_POSTFIX))
    }

    async finalizeCeremony(ceremonyId: number) {
        const ceremony = await this.findById(ceremonyId)
        const { circuits } = ceremony
        // Get final contribution for each circuit.
        // nb. the `getFinalContributionFromCircuit` returns the final contribution or none.
        // Therefore, we just need to call the method without taking any data to verify the pre-condition of having already computed
        // the final contributions for each ceremony circuit.
        for (const circuit of circuits) {
            const contribution = await this.circuitsService.getFinalContributionFromCircuit(ceremonyId, circuit.id)
            if (!contribution) logAndThrowError(SPECIFIC_ERRORS.SE_FINALIZE_NO_FINAL_CONTRIBUTION)
        }

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

                    await terminateEC2Instance(ec2Client as any, vm.vmInstanceId)
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
                    [Op.lte]: Date.now()
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
                    [Op.lte]: Date.now()
                }
            }
        })
        openedCeremoniesUntilNow.forEach(async (ceremony) => {
            await ceremony.update({ state: CeremonyState.CLOSED })
            printLog(`Ceremony ${ceremony.id} is now closed`, LogLevel.DEBUG)
        })
    }
}
