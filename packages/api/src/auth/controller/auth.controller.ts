import { Controller, Get, Req, UseGuards } from "@nestjs/common"
import { AuthGuard } from "@nestjs/passport"
import { AuthService } from "../service/auth.service"

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
}
