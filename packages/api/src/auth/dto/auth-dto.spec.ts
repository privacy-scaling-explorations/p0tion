import { JWTDto, DeviceFlowTokenDto, GithubUser } from "./auth-dto"
import { validate } from "class-validator"
import { User } from "../../users/entities/user.entity"

describe("Auth DTOs", () => {
    describe("JWTDto", () => {
        it("should be valid with correct data", async () => {
            const jwtDto = new JWTDto()
            jwtDto.exp = 1234567890
            jwtDto.sub = "user123"
            jwtDto.user = {} as User

            const errors = await validate(jwtDto)
            expect(errors.length).toBe(0)
        })

        it("should be invalid with incorrect data types", async () => {
            const jwtDto = new JWTDto()
            ;(jwtDto as any).exp = "not a number"
            ;(jwtDto as any).sub = 12345
            jwtDto.user = {} as User

            const errors = await validate(jwtDto)
            expect(errors.length).toBeGreaterThan(0)
        })
    })

    describe("DeviceFlowTokenDto", () => {
        it("should be valid with correct data", async () => {
            const deviceFlowTokenDto = new DeviceFlowTokenDto()
            deviceFlowTokenDto.access_token = "valid_token"
            deviceFlowTokenDto.token_type = "bearer"

            const errors = await validate(deviceFlowTokenDto)
            expect(errors.length).toBe(0)
        })

        it("should be invalid with missing data", async () => {
            const deviceFlowTokenDto = new DeviceFlowTokenDto()

            const errors = await validate(deviceFlowTokenDto)
            expect(errors.length).toBeGreaterThan(0)
        })
    })

    describe("GithubUser", () => {
        it("should create a valid GithubUser object with all properties", () => {
            const githubUser = new GithubUser()
            githubUser.login = "testuser"
            githubUser.id = 12345
            githubUser.node_id = "MDQ6VXNlcjEyMzQ1"
            githubUser.avatar_url = "https://example.com/avatar.jpg"
            githubUser.gravatar_id = ""
            githubUser.url = "https://api.github.com/users/testuser"
            githubUser.html_url = "https://github.com/testuser"
            githubUser.followers_url = "https://api.github.com/users/testuser/followers"
            githubUser.following_url = "https://api.github.com/users/testuser/following{/other_user}"
            githubUser.gists_url = "https://api.github.com/users/testuser/gists{/gist_id}"
            githubUser.starred_url = "https://api.github.com/users/testuser/starred{/owner}{/repo}"
            githubUser.subscriptions_url = "https://api.github.com/users/testuser/subscriptions"
            githubUser.organizations_url = "https://api.github.com/users/testuser/orgs"
            githubUser.repos_url = "https://api.github.com/users/testuser/repos"
            githubUser.events_url = "https://api.github.com/users/testuser/events{/privacy}"
            githubUser.received_events_url = "https://api.github.com/users/testuser/received_events"
            githubUser.type = "User"
            githubUser.site_admin = false
            githubUser.name = "Test User"
            githubUser.company = "Test Company"
            githubUser.blog = "https://testuser.com"
            githubUser.location = "Test City"
            githubUser.email = "testuser@example.com"
            githubUser.hireable = true
            githubUser.bio = "A passionate developer"
            githubUser.twitter_username = "testuser"
            githubUser.public_repos = 10
            githubUser.public_gists = 5
            githubUser.followers = 100
            githubUser.following = 50
            githubUser.created_at = "2021-01-01T00:00:00Z"
            githubUser.updated_at = "2023-01-01T00:00:00Z"

            expect(githubUser).toBeDefined()
            expect(githubUser.login).toBe("testuser")
            expect(githubUser.id).toBe(12345)
            expect(githubUser.avatar_url).toBe("https://example.com/avatar.jpg")
            expect(githubUser.name).toBe("Test User")
            expect(githubUser.email).toBe("testuser@example.com")
            expect(githubUser.public_repos).toBe(10)
            expect(githubUser.followers).toBe(100)
            expect(githubUser.following).toBe(50)
            expect(githubUser.created_at).toBe("2021-01-01T00:00:00Z")
            expect(githubUser.updated_at).toBe("2023-01-01T00:00:00Z")
        })

        it("should allow partial initialization of GithubUser", () => {
            const partialGithubUser = new GithubUser()
            partialGithubUser.login = "partialuser"
            partialGithubUser.id = 67890
            partialGithubUser.avatar_url = "https://example.com/partial-avatar.jpg"

            expect(partialGithubUser).toBeDefined()
            expect(partialGithubUser.login).toBe("partialuser")
            expect(partialGithubUser.id).toBe(67890)
            expect(partialGithubUser.avatar_url).toBe("https://example.com/partial-avatar.jpg")
            expect(partialGithubUser.name).toBeUndefined()
            expect(partialGithubUser.email).toBeUndefined()
        })
    })
})
