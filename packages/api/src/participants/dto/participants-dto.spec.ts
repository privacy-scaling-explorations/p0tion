import { validate } from "class-validator"
import {
    ParticipantsDto,
    PermanentlyStoreCurrentContributionTimeAndHash,
    TemporaryStoreCurrentContributionMultiPartUploadId
} from "./participants-dto"
import { ParticipantStatus, ParticipantContributionStep, TimeoutType } from "@p0tion/actions"

describe("ParticipantsDto", () => {
    it("should be defined", () => {
        expect(new ParticipantsDto()).toBeDefined()
    })
})

describe("PermanentlyStoreCurrentContributionTimeAndHash", () => {
    it("should be defined", () => {
        expect(new PermanentlyStoreCurrentContributionTimeAndHash()).toBeDefined()
    })

    it("should pass validation with correct data", async () => {
        const dto = new PermanentlyStoreCurrentContributionTimeAndHash()
        dto.contributionComputationTime = 1000
        dto.contributionHash = "abcdef123456"

        const errors = await validate(dto)
        expect(errors.length).toBe(0)
    })

    it("should fail validation with incorrect data types", async () => {
        const dto = new PermanentlyStoreCurrentContributionTimeAndHash()
        ;(dto as any).contributionComputationTime = "not a number"
        ;(dto as any).contributionHash = 12345

        const errors = await validate(dto)
        expect(errors.length).toBe(2)
    })
})

describe("TemporaryStoreCurrentContributionMultiPartUploadId", () => {
    it("should be defined", () => {
        expect(new TemporaryStoreCurrentContributionMultiPartUploadId()).toBeDefined()
    })

    it("should allow setting and getting uploadId", () => {
        const dto = new TemporaryStoreCurrentContributionMultiPartUploadId()
        dto.uploadId = "test-upload-id"
        expect(dto.uploadId).toBe("test-upload-id")
    })
})

// Additional tests to demonstrate the use of enumerations
describe("Enumerations", () => {
    it("should use correct ParticipantStatus values", () => {
        expect(ParticipantStatus.CREATED).toBe("CREATED")
        expect(ParticipantStatus.WAITING).toBe("WAITING")
        expect(ParticipantStatus.CONTRIBUTING).toBe("CONTRIBUTING")
    })

    it("should use correct ParticipantContributionStep values", () => {
        expect(ParticipantContributionStep.DOWNLOADING).toBe("DOWNLOADING")
        expect(ParticipantContributionStep.COMPUTING).toBe("COMPUTING")
        expect(ParticipantContributionStep.UPLOADING).toBe("UPLOADING")
    })

    it("should use correct TimeoutType values", () => {
        expect(TimeoutType.BLOCKING_CONTRIBUTION).toBe("BLOCKING_CONTRIBUTION")
        expect(TimeoutType.BLOCKING_CLOUD_FUNCTION).toBe("BLOCKING_CLOUD_FUNCTION")
    })
})
