import "reflect-metadata"
import { validate } from "class-validator"
import {
    CircuitDto,
    CompilerDto,
    TemplateDto,
    VerificationDto,
    CircuitArtifactsDto,
    CompilationArtifactsDto,
    MetadataDto,
    FileDto,
    AvgTimingsDto,
    WaitingQueueDto
} from "./circuits-dto"
import { CircuitContributionVerificationMechanism, DiskTypeForVM } from "@p0tion/actions"

describe("CircuitsDto", () => {
    describe("CircuitDto", () => {
        it("should be defined", () => {
            expect(new CircuitDto()).toBeDefined()
        })

        it("should validate a complete CircuitDto", async () => {
            const circuitDto = new CircuitDto()
            circuitDto.compiler = { version: "1.0.0", commitHash: "abc123" }
            circuitDto.template = { source: "template.circom", commitHash: "def456", paramsConfiguration: [1, 2, 3] }
            circuitDto.verification = { cfOrVm: CircuitContributionVerificationMechanism.CF }
            circuitDto.artifacts = { r1csStoragePath: "/path/to/r1cs", wasmStoragePath: "/path/to/wasm" }
            circuitDto.prefix = "test"
            circuitDto.description = "Test circuit"

            const errors = await validate(circuitDto)
            expect(errors.length).toBe(0)
        })

        it("should fail validation with missing required fields", async () => {
            const circuitDto = new CircuitDto()
            const errors = await validate(circuitDto)
            expect(errors.length).toBeGreaterThan(0)
        })
    })

    describe("CompilerDto", () => {
        it("should validate CompilerDto", async () => {
            const compilerDto = new CompilerDto()
            compilerDto.version = "1.0.0"
            compilerDto.commitHash = "abc123"

            const errors = await validate(compilerDto)
            expect(errors.length).toBe(0)
        })
    })

    describe("TemplateDto", () => {
        it("should validate TemplateDto", async () => {
            const templateDto = new TemplateDto()
            templateDto.source = "template.circom"
            templateDto.commitHash = "def456"
            templateDto.paramsConfiguration = [1, 2, 3]

            const errors = await validate(templateDto)
            expect(errors.length).toBe(0)
        })
    })

    describe("VerificationDto", () => {
        it("should validate VerificationDto with CF", async () => {
            const verificationDto = new VerificationDto()
            verificationDto.cfOrVm = CircuitContributionVerificationMechanism.CF

            const errors = await validate(verificationDto)
            expect(errors.length).toBe(0)
        })

        it("should validate VerificationDto with VM", async () => {
            const verificationDto = new VerificationDto()
            verificationDto.cfOrVm = CircuitContributionVerificationMechanism.VM
            verificationDto.vm = {
                vmConfigurationType: "type1",
                vmDiskType: DiskTypeForVM.GP2,
                vmDiskSize: 100,
                vmInstanceId: "instance-1"
            }

            const errors = await validate(verificationDto)
            expect(errors.length).toBe(0)
        })
    })

    describe("CircuitArtifactsDto", () => {
        it("should validate CircuitArtifactsDto", async () => {
            const artifactsDto = new CircuitArtifactsDto()
            artifactsDto.r1csStoragePath = "/path/to/r1cs"
            artifactsDto.wasmStoragePath = "/path/to/wasm"

            const errors = await validate(artifactsDto)
            expect(errors.length).toBe(0)
        })
    })

    describe("CompilationArtifactsDto", () => {
        it("should validate CompilationArtifactsDto", async () => {
            const compilationArtifactsDto = new CompilationArtifactsDto()
            compilationArtifactsDto.r1csFilename = "circuit.r1cs"
            compilationArtifactsDto.wasmFilename = "circuit.wasm"

            const errors = await validate(compilationArtifactsDto)
            expect(errors.length).toBe(0)
        })
    })

    describe("MetadataDto", () => {
        it("should validate MetadataDto", async () => {
            const metadataDto = new MetadataDto()
            metadataDto.curve = "bn128"
            metadataDto.wires = 1000
            metadataDto.constraints = 500
            metadataDto.privateInputs = 10
            metadataDto.publicInputs = 5
            metadataDto.labels = 100
            metadataDto.outputs = 2
            metadataDto.pot = 20

            const errors = await validate(metadataDto)
            expect(errors.length).toBe(0)
        })
    })

    describe("FileDto", () => {
        it("should validate FileDto", async () => {
            const fileDto = new FileDto()
            fileDto.potFilename = "pot.ptau"
            fileDto.r1csFilename = "circuit.r1cs"
            fileDto.wasmFilename = "circuit.wasm"
            fileDto.initialZkeyFilename = "circuit_0000.zkey"
            fileDto.potStoragePath = "/path/to/pot"
            fileDto.r1csStoragePath = "/path/to/r1cs"
            fileDto.wasmStoragePath = "/path/to/wasm"
            fileDto.initialZkeyStoragePath = "/path/to/zkey"
            fileDto.potBlake2bHash = "hash1"
            fileDto.r1csBlake2bHash = "hash2"
            fileDto.wasmBlake2bHash = "hash3"
            fileDto.initialZkeyBlake2bHash = "hash4"

            const errors = await validate(fileDto)
            expect(errors.length).toBe(0)
        })
    })

    describe("AvgTimingsDto", () => {
        it("should validate AvgTimingsDto", async () => {
            const avgTimingsDto = new AvgTimingsDto()
            avgTimingsDto.contributionComputation = 100
            avgTimingsDto.fullContribution = 150
            avgTimingsDto.verifyCloudFunction = 50

            const errors = await validate(avgTimingsDto)
            expect(errors.length).toBe(0)
        })
    })

    describe("WaitingQueueDto", () => {
        it("should validate WaitingQueueDto", async () => {
            const waitingQueueDto = new WaitingQueueDto()
            waitingQueueDto.completedContributions = 5
            waitingQueueDto.contributors = ["user1", "user2", "user3"]
            waitingQueueDto.currentContributor = "user4"
            waitingQueueDto.failedContributions = 1

            const errors = await validate(waitingQueueDto)
            expect(errors.length).toBe(0)
        })
    })
})
