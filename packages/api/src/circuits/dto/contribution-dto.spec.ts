import "reflect-metadata"
import { validate } from "class-validator"
import {
    ContributionFiles,
    ContributionVerificationSoftware,
    BeaconInfo,
    VerifyContributionData
} from "./contribution-dto"

describe("ContributionDto", () => {
    it("should validate ContributionFiles", async () => {
        const files = new ContributionFiles()
        files.transcriptFilename = "transcript.txt"
        files.lastZkeyFilename = "zkey.zkey"
        files.transcriptStoragePath = "/path/to/transcript"
        files.lastZkeyStoragePath = "/path/to/zkey"
        files.transcriptBlake2bHash = "hash1"
        files.lastZkeyBlake2bHash = "hash2"

        const errors = await validate(files)
        expect(errors.length).toBe(0)
    })

    it("should validate ContributionVerificationSoftware", async () => {
        const software = new ContributionVerificationSoftware()
        software.name = "Verifier"
        software.version = "1.0.0"
        software.commitHash = "abc123"

        const errors = await validate(software)
        expect(errors.length).toBe(0)
    })

    it("should validate BeaconInfo", async () => {
        const beacon = new BeaconInfo()
        beacon.value = "random_beacon"
        beacon.hash = "beacon_hash"

        const errors = await validate(beacon)
        expect(errors.length).toBe(0)
    })

    it("should validate VerifyContributionData", async () => {
        const data = new VerifyContributionData()
        data.circuitId = 1
        data.contributorOrCoordinatorIdentifier = "user123"

        const errors = await validate(data)
        expect(errors.length).toBe(0)
    })

    it("should fail validation with missing required fields", async () => {
        const files = new ContributionFiles()
        const errors = await validate(files)
        expect(errors.length).toBeGreaterThan(0)
    })
})
