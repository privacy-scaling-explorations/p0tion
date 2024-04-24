import { Injectable } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import { InjectModel } from "@nestjs/sequelize"
import { DeviceFlowEntity } from "../entities/device-flow.entity"

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(DeviceFlowEntity)
        private deviceFlowModel: typeof DeviceFlowEntity
    ) {}

    loginWithGithub() {}

    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async checkIfUserHasSignedIn() {
        const deviceFlows = await this.deviceFlowModel.findAll()
        deviceFlows.forEach(async (deviceFlow) => {
            try {
                const result = await fetch("https://github.com/login/oauth/access_token", {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        client_id: process.env.GITHUB_ID,
                        device_code: deviceFlow.deviceCode,
                        grant_type: "urn:ietf:params:oauth:grant-type:device_code"
                    })
                }).then((res) => res.json())
                console.log(result)
                // Delete device code from database if access_token is present in result
            } catch (error) {
                // TODO: handle error for network connection fails
            }
        })
        return
    }
}
