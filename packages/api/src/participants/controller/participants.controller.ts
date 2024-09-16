import { Body, Controller, Get, Post, Put, Query, Request, UseGuards } from "@nestjs/common"
import { JWTDto } from "../../auth/dto/auth-dto"
import { ParticipantsService } from "../service/participants.service"
import { CeremonyGuard } from "../../auth/guard/ceremony.guard"
import { JWTGuard } from "../../auth/guard/jwt.guard"
import {
    ParticipantsDto,
    PermanentlyStoreCurrentContributionTimeAndHash,
    TemporaryStoreCurrentContributionMultiPartUploadId
} from "../dto/participants-dto"
import { TemporaryStoreCurrentContributionUploadedChunkData } from "../../storage/dto/storage-dto"

@Controller("participants")
export class ParticipantsController {
    constructor(private readonly participantsService: ParticipantsService) {}

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Put("/update-participant")
    updateParticipant(
        @Query("ceremonyId") ceremonyId: number,
        @Request() { jwt }: { jwt: JWTDto },
        @Body() data: Partial<ParticipantsDto>
    ) {
        return this.participantsService.updateByUserIdAndCeremonyId(jwt.user.id, ceremonyId, data)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/get-participant")
    getParticipant(@Query("ceremonyId") ceremonyId: number, @Request() { jwt }: { jwt: JWTDto }) {
        return this.participantsService.findParticipantOfCeremony(jwt.user.id, ceremonyId)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/get-participant-by-id")
    getParticipantById(@Query("ceremonyId") ceremonyId: number, @Query("participantId") participantId: string) {
        return this.participantsService.findParticipantOfCeremony(participantId, ceremonyId)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/get-all-participants-by-ceremony-id")
    getAllParticipantsByCeremonyId(@Query("ceremonyId") ceremonyId: number) {
        return this.participantsService.findAllParticipantsByCeremonyId(ceremonyId)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/get-current-participant")
    getCurrentParticipant(@Query("ceremonyId") ceremonyId: number) {
        return this.participantsService.findCurrentParticipantOfCeremony(ceremonyId)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/get-current-active-participant-timeout")
    getCurrentActiveParticipantTimeout(
        @Query("ceremonyId") ceremonyId: number,
        @Query("participantId") participantId: string
    ) {
        return this.participantsService.findCurrentActiveParticipantTimeout(ceremonyId, participantId)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/resume-contribution-after-timeout-expiration")
    resumeContributionAfterTimeoutExpiration(
        @Query("ceremonyId") ceremonyId: number,
        @Request() { jwt }: { jwt: JWTDto }
    ) {
        return this.participantsService.resumeContributionAfterTimeoutExpiration(ceremonyId, jwt.user.id)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/check-participant-for-ceremony")
    checkParticipantForCeremony(@Query("ceremonyId") ceremonyId: number, @Request() { jwt }: { jwt: JWTDto }) {
        return this.participantsService.checkParticipantForCeremony(ceremonyId, jwt.user.id)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/progress-to-next-circuit-for-contribution")
    progressToNextCircuitForContribution(@Query("ceremonyId") ceremonyId: number, @Request() { jwt }: { jwt: JWTDto }) {
        return this.participantsService.progressToNextCircuitForContribution(ceremonyId, jwt.user.id)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/progress-to-next-contribution-step")
    progressToNextContributionStep(@Query("ceremonyId") ceremonyId: number, @Request() { jwt }: { jwt: JWTDto }) {
        return this.participantsService.progressToNextContributionStep(ceremonyId, jwt.user.id)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Post("/permanently-store-current-contribution-time-and-hash")
    permanentlyStoreCurrentContributionTimeAndHash(
        @Query("ceremonyId") ceremonyId: number,
        @Request() { jwt }: { jwt: JWTDto },
        @Body() data: PermanentlyStoreCurrentContributionTimeAndHash
    ) {
        return this.participantsService.permanentlyStoreCurrentContributionTimeAndHash(ceremonyId, jwt.user.id, data)
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Post("/temporary-store-current-contribution-multipart-upload-id")
    temporaryStoreCurrentContributionMultipartUploadId(
        @Query("ceremonyId") ceremonyId: number,
        @Request() { jwt }: { jwt: JWTDto },
        @Body() data: TemporaryStoreCurrentContributionMultiPartUploadId
    ) {
        return this.participantsService.temporaryStoreCurrentContributionMultipartUploadId(
            ceremonyId,
            jwt.user.id,
            data
        )
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Post("/temporary-store-current-contribution-uploaded-chunk-data")
    temporaryStoreCurrentContributionUploadedChunkData(
        @Query("ceremonyId") ceremonyId: number,
        @Request() { jwt }: { jwt: JWTDto },
        @Body() data: TemporaryStoreCurrentContributionUploadedChunkData
    ) {
        return this.participantsService.temporaryStoreCurrentContributionUploadedChunkData(
            ceremonyId,
            jwt.user.id,
            data
        )
    }

    @UseGuards(CeremonyGuard)
    @UseGuards(JWTGuard)
    @Get("/check-and-prepare-coordinator-for-finalization")
    checkAndPrepareCoordinatorForFinalization(
        @Query("ceremonyId") ceremonyId: number,
        @Request() { jwt }: { jwt: JWTDto }
    ) {
        return this.participantsService.checkAndPrepareCoordinatorForFinalization(ceremonyId, jwt.user.id)
    }
}
