import { Controller, Get, Req, UseGuards } from "@nestjs/common"
import { AuthGuard } from "@nestjs/passport"

@Controller("auth")
export class AuthController {
    constructor() {}

    @Get("github")
    @UseGuards(AuthGuard("github"))
    async login() {}

    @Get("github/callback")
    @UseGuards(AuthGuard("github"))
    async authCallback(@Req() req) {
        return req.user
    }
}
