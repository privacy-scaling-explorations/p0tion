import { Body, Controller, Get, Post } from "@nestjs/common"
import { AuthService } from "../service/auth.service"
import { DeviceFlowTokenDto } from "../dto/auth-dto"

@Controller("auth")
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Get("github/client-id")
    async githubClientId() {
        return this.authService.getGithubClientId()
    }

    @Post("github/user")
    async githubUser(@Body() deviceFlowTokenDto: DeviceFlowTokenDto) {
        return this.authService.getUserInfoFromGithub(deviceFlowTokenDto)
    }
}
