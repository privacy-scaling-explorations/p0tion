import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common"
import { AuthGuard } from "@nestjs/passport"
import { AuthService } from "../service/auth.service"
import { DeviceFlowTokenDto } from "../dto/auth-dto"

@Controller("auth")
export class AuthController {
    constructor(private readonly authService: AuthService) {}
    @Get("github")
    @UseGuards(AuthGuard("github"))
    async login() {}

    @Get("github/callback")
    @UseGuards(AuthGuard("github"))
    async authCallback(@Req() req) {
        return req.user
    }

    @Get("github/device-flow")
    async githubDeviceFlow() {
        return this.authService.requestDeviceFlowURL()
    }

    @Post("github/user")
    async getUser(@Body() deviceFlowTokenDto: DeviceFlowTokenDto) {
        return this.authService.getUserInfoFromGithub(deviceFlowTokenDto)
    }
}
