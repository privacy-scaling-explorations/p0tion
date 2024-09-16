import "reflect-metadata"
import { validate, validateSync } from "class-validator"
import {
    ObjectKeyDto,
    UploadIdDto,
    GeneratePreSignedUrlsPartsData,
    ETagWithPartNumber,
    TemporaryStoreCurrentContributionUploadedChunkData,
    CompleteMultiPartUploadData
} from "./storage-dto"
import { plainToClass } from "class-transformer"

describe("StorageDto", () => {
    describe("ObjectKeyDto", () => {
        it("should validate with correct data", async () => {
            const dto = new ObjectKeyDto()
            dto.objectKey = "validObjectKey"
            const errors = await validate(dto)
            expect(errors.length).toBe(0)
        })

        it("should fail validation with undefined objectKey", async () => {
            const dto = new ObjectKeyDto()
            const errors = await validate(dto)
            expect(errors.length).toBeGreaterThan(0)
        })
    })

    describe("UploadIdDto", () => {
        it("should validate with correct data", async () => {
            const dto = new UploadIdDto()
            dto.uploadId = "validUploadId"
            const errors = await validate(dto)
            expect(errors.length).toBe(0)
        })

        it("should fail validation with undefined uploadId", async () => {
            const dto = new UploadIdDto()
            const errors = await validate(dto)
            expect(errors.length).toBeGreaterThan(0)
        })
    })

    describe("GeneratePreSignedUrlsPartsData", () => {
        it("should validate with correct data", async () => {
            const dto = new GeneratePreSignedUrlsPartsData()
            dto.objectKey = "validObjectKey"
            dto.uploadId = "validUploadId"
            dto.numberOfParts = 5
            const errors = await validate(dto)
            expect(errors.length).toBe(0)
        })

        it("should fail validation with negative numberOfParts", async () => {
            const dto = new GeneratePreSignedUrlsPartsData()
            dto.objectKey = "validObjectKey"
            dto.uploadId = "validUploadId"
            dto.numberOfParts = -1
            const errors = await validate(dto)
            expect(errors.length).toBeGreaterThan(0)
        })
    })

    describe("ETagWithPartNumber", () => {
        it("should validate with correct data", async () => {
            const dto = new ETagWithPartNumber()
            dto.ETag = "validETag"
            dto.PartNumber = 1
            const errors = await validate(dto)
            expect(errors.length).toBe(0)
        })

        it("should fail validation with non-numeric PartNumber", async () => {
            const dto = new ETagWithPartNumber()
            dto.ETag = "validETag"
            dto.PartNumber = "invalid" as any
            const errors = await validate(dto)
            expect(errors.length).toBeGreaterThan(0)
        })
    })

    describe("TemporaryStoreCurrentContributionUploadedChunkData", () => {
        it("should validate with correct data", () => {
            const dto = new TemporaryStoreCurrentContributionUploadedChunkData()
            dto.chunk = { ETag: "validETag", PartNumber: 1 }
            const errors = validateSync(dto)
            expect(errors.length).toBe(0)
        })

        it("should fail validation with invalid chunk data", () => {
            const plainObject = {
                chunk: { ETag: "", PartNumber: 0 }
            }
            const dto = plainToClass(TemporaryStoreCurrentContributionUploadedChunkData, plainObject)
            const errors = validateSync(dto, { validationError: { target: false } })
            expect(errors.length).toBeGreaterThan(0)
        })
    })

    describe("CompleteMultiPartUploadData", () => {
        it("should validate with correct data", async () => {
            const dto = new CompleteMultiPartUploadData()
            dto.objectKey = "validObjectKey"
            dto.uploadId = "validUploadId"
            dto.parts = [{ ETag: "validETag", PartNumber: 1 }]
            const errors = await validate(dto)
            expect(errors.length).toBe(0)
        })

        it("should fail validation with empty parts array", async () => {
            const dto = new CompleteMultiPartUploadData()
            dto.objectKey = "validObjectKey"
            dto.uploadId = "validUploadId"
            dto.parts = []
            const errors = await validate(dto)
            expect(errors.length).toBeGreaterThan(0)
        })

        it("should fail validation with missing required fields", async () => {
            const dto = new CompleteMultiPartUploadData()
            const errors = await validate(dto)
            expect(errors.length).toBeGreaterThan(0)
        })
    })
})
