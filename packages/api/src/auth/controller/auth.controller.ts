import { Controller, Get, Req, UseGuards } from "@nestjs/common"
import { AuthGuard } from "@nestjs/passport"
import { InjectModel } from "@nestjs/sequelize"
import { DeviceFlowEntity } from "../entities/device-flow.entity"

@Controller("auth")
export class AuthController {
    constructor(
        @InjectModel(DeviceFlowEntity)
        private deviceFlowModel: typeof DeviceFlowEntity
    ) {}

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
        const result = await fetch("https://github.com/login/device/code", {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                client_id: process.env.GITHUB_ID
            })
        }).then((res) => res.json())

        const deviceCode = result.device_code
        const initialTime = Date.now()
        await this.deviceFlowModel.create({ deviceCode, initialTime })

        return result
    }
}
