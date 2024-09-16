import "reflect-metadata"
import { validate } from "class-validator"
import { CeremonyDto, CreateCircuitsDto } from "./ceremony-dto"
import {
    CeremonyState,
    CeremonyTimeoutType,
    CeremonyType,
    CircuitContributionVerificationMechanism
} from "@p0tion/actions"
import { AuthProvider } from "../../types/enums"
import { CircuitDto } from "../../circuits/dto/circuits-dto"

describe("CeremoniesDto", () => {
    describe("CeremonyDto", () => {
        it("should be defined", () => {
            expect(new CeremonyDto()).toBeDefined()
        })

        it("should pass validation with correct data", async () => {
            const dto = new CeremonyDto()
            dto.prefix = "test"
            dto.state = CeremonyState.SCHEDULED
            dto.type = CeremonyType.PHASE2
            dto.coordinatorId = "123"
            dto.title = "Test Ceremony"
            dto.description = "A test ceremony"
            dto.startDate = Date.now()
            dto.endDate = Date.now() + 86400000 // 1 day later
            dto.timeoutMechanismType = CeremonyTimeoutType.DYNAMIC
            dto.penalty = 100
            dto.authProviders = [AuthProvider.GITHUB]
            dto.github = {
                minimumFollowing: 5,
                minimumFollowers: 10,
                minimumPublicRepos: 3,
                minimumAge: 30
            }
            dto.siwe = {
                minimumNonce: 5,
                blockHeight: 1000000,
                chainName: "ethereum"
            }
            dto.bandada = {
                groupId: "test-group-id"
            }

            const errors = await validate(dto)
            expect(errors.length).toBe(0)
        })

        it("should fail validation with incorrect data", async () => {
            const dto = new CeremonyDto()
            const errors = await validate(dto)
            expect(errors.length).toBeGreaterThan(0)
        })
    })

    describe("CreateCircuitsDto", () => {
        it("should be defined", () => {
            expect(new CreateCircuitsDto()).toBeDefined()
        })

        it("should pass validation with correct data", async () => {
            const circuitDto = new CircuitDto()
            circuitDto.name = "Test Circuit"
            circuitDto.compiler = {
                version: "1.0.0",
                commitHash: "abc123"
            }
            circuitDto.template = {
                source: "template source",
                commitHash: "def456",
                paramsConfiguration: [1, 2, 3]
            }
            circuitDto.verification = {
                cfOrVm: CircuitContributionVerificationMechanism.CF
            }
            circuitDto.artifacts = {
                r1csStoragePath: "/path/to/r1cs",
                wasmStoragePath: "/path/to/wasm"
            }
            circuitDto.prefix = "test_circuit"
            circuitDto.description = "A test circuit"
            circuitDto.zKeySizeInBytes = 1000000

            const dto = new CreateCircuitsDto()
            dto.circuits = [circuitDto]

            const errors = await validate(dto)
            expect(errors.length).toBe(0)
        })

        it("should fail validation with empty circuits array", async () => {
            const dto = new CreateCircuitsDto()
            dto.circuits = []

            const errors = await validate(dto)
            expect(errors.length).toBeGreaterThan(0)
        })

        it("should fail validation with invalid circuit data", async () => {
            const invalidCircuitDto = new CircuitDto()
            // Not setting any properties to make it invalid

            const dto = new CreateCircuitsDto()
            dto.circuits = [invalidCircuitDto]

            const errors = await validate(dto)
            expect(errors.length).toBeGreaterThan(0)
        })
    })
})
