import { Test, TestingModule } from "@nestjs/testing"
import { ExecutionContext, UnauthorizedException } from "@nestjs/common"
import { CeremonyGuard } from "./ceremony.guard"
import { CeremoniesService } from "../../ceremonies/service/ceremonies.service"
import * as actions from "@p0tion/actions"

jest.mock("@p0tion/actions")

describe("CeremonyGuard", () => {
    let guard: CeremonyGuard
    let mockCeremoniesService: Partial<CeremoniesService>

    const createMockContext = (provider: string, userId: string, ceremonyId: string, body?: any): ExecutionContext =>
        ({
            switchToHttp: () => ({
                getRequest: () => ({
                    jwt: { user: { provider, id: userId } },
                    query: { ceremonyId },
                    body
                })
            })
        }) as ExecutionContext

    beforeEach(async () => {
        mockCeremoniesService = {
            findById: jest.fn()
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [CeremonyGuard, { provide: CeremoniesService, useValue: mockCeremoniesService }]
        }).compile()

        guard = module.get<CeremonyGuard>(CeremonyGuard)
    })

    it("should be defined", () => {
        expect(guard).toBeDefined()
    })

    it("should allow access for eligible GitHub user", async () => {
        const mockCeremony = {
            authProviders: ["github"],
            github: {
                minimumFollowing: 10,
                minimumFollowers: 20,
                minimumPublicRepos: 5,
                minimumAge: 180 // 180 days (about 6 months)
            }
        }
        mockCeremoniesService.findById = jest.fn().mockResolvedValue(mockCeremony)
        ;(actions.githubReputation as jest.Mock).mockResolvedValue({
            reputable: true,
            avatarUrl: "https://example.com/avatar.jpg"
        })

        const mockContext = createMockContext("github", "user123", "ceremony-uuid-1")

        await expect(guard.canActivate(mockContext)).resolves.toBe(true)

        expect(actions.githubReputation).toHaveBeenCalledWith(
            "user123",
            mockCeremony.github.minimumFollowing,
            mockCeremony.github.minimumFollowers,
            mockCeremony.github.minimumPublicRepos,
            mockCeremony.github.minimumAge
        )
    })

    it("should throw UnauthorizedException for ineligible GitHub user", async () => {
        const mockCeremony = {
            authProviders: ["github"],
            github: {
                minimumFollowing: 50,
                minimumFollowers: 100,
                minimumPublicRepos: 15,
                minimumAge: 365 // 1 year
            }
        }
        mockCeremoniesService.findById = jest.fn().mockResolvedValue(mockCeremony)
        ;(actions.githubReputation as jest.Mock).mockResolvedValue({
            reputable: false,
            message: "Not enough reputation"
        })

        const mockContext = createMockContext("github", "newuser456", "ceremony-uuid-2")

        await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException)
    })

    it("should allow access for eligible SIWE user", async () => {
        const mockCeremony = {
            authProviders: ["siwe"],
            siwe: {
                minimumNonce: 5,
                blockHeight: 15000000, // A realistic Ethereum block height
                chainName: "ethereum"
            }
        }
        mockCeremoniesService.findById = jest.fn().mockResolvedValue(mockCeremony)
        ;(actions.siweReputation as jest.Mock).mockResolvedValue({ reputable: true })

        const mockContext = createMockContext("siwe", "0x1234567890123456789012345678901234567890", "ceremony-uuid-3")

        await expect(guard.canActivate(mockContext)).resolves.toBe(true)

        expect(actions.siweReputation).toHaveBeenCalledWith(
            "0x1234567890123456789012345678901234567890",
            mockCeremony.siwe.minimumNonce,
            mockCeremony.siwe.blockHeight,
            mockCeremony.siwe.chainName
        )
    })

    it("should throw UnauthorizedException for ineligible SIWE user", async () => {
        const mockCeremony = {
            authProviders: ["siwe"],
            siwe: {
                minimumNonce: 10,
                blockHeight: 16000000,
                chainName: "ethereum"
            }
        }
        mockCeremoniesService.findById = jest.fn().mockResolvedValue(mockCeremony)
        ;(actions.siweReputation as jest.Mock).mockResolvedValue({ reputable: false, message: "Not enough reputation" })

        const mockContext = createMockContext("siwe", "0x9876543210987654321098765432109876543210", "ceremony-uuid-4")

        await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException)
    })

    it("should allow access for eligible Bandada user", async () => {
        const mockCeremony = {
            authProviders: ["bandada"],
            bandada: {
                groupId: "trusted-contributors-group"
            }
        }
        mockCeremoniesService.findById = jest.fn().mockResolvedValue(mockCeremony)
        ;(actions.bandadaReputation as jest.Mock).mockResolvedValue({ reputable: true })

        const mockContext = createMockContext("bandada", "user789", "ceremony-uuid-5", {
            proof: "validProof123",
            publicSignals: "validPublicSignals456"
        })

        await expect(guard.canActivate(mockContext)).resolves.toBe(true)

        expect(actions.bandadaReputation).toHaveBeenCalledWith(
            "user789",
            "validProof123",
            "validPublicSignals456",
            mockCeremony.bandada.groupId
        )
    })

    it("should throw UnauthorizedException for ineligible Bandada user", async () => {
        const mockCeremony = {
            authProviders: ["bandada"],
            bandada: {
                groupId: "exclusive-contributors-group"
            }
        }
        mockCeremoniesService.findById = jest.fn().mockResolvedValue(mockCeremony)
        ;(actions.bandadaReputation as jest.Mock).mockResolvedValue({ reputable: false, message: "Not in group" })

        const mockContext = createMockContext("bandada", "newuser101", "ceremony-uuid-6", {
            proof: "invalidProof789",
            publicSignals: "invalidPublicSignals012"
        })

        await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException)
    })

    it("should throw UnauthorizedException for unsupported provider", async () => {
        const mockCeremony = {
            authProviders: ["github"]
        }
        mockCeremoniesService.findById = jest.fn().mockResolvedValue(mockCeremony)

        const mockContext = createMockContext("unsupported", "user999", "ceremony-uuid-7")

        await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException)
    })
})
