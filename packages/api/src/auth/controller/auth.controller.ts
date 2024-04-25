import { Body, Controller, Get, Post } from "@nestjs/common"
import { AuthService } from "../service/auth.service"
import { DeviceFlowTokenDto } from "../dto/auth-dto"

@Controller("auth")
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Get("github/client_id")
    async githubClientId() {
        return process.env.GITHUB_CLIENT_ID
    }

    @Post("github/user")
    async githubUser(@Body() deviceFlowTokenDto: DeviceFlowTokenDto) {
        return this.authService.getUserInfoFromGithub(deviceFlowTokenDto)
    }
}
