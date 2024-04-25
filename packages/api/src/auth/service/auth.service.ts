import { Injectable } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import { InjectModel } from "@nestjs/sequelize"
import { DeviceFlowEntity } from "../entities/device-flow.entity"
import { DeviceFlowTokenDto, GithubUser } from "../dto/auth-dto"

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(DeviceFlowEntity)
        private deviceFlowModel: typeof DeviceFlowEntity
    ) {}

    loginWithGithub() {}

    async requestDeviceFlowURL() {
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

    async getUserInfoFromGithub(deviceFlowTokenDto: DeviceFlowTokenDto) {
        try {
            const result = (await fetch("https://api.github.com/user", {
                headers: {
                    Authorization: `token ${deviceFlowTokenDto.access_token}`
                }
            }).then((res) => res.json())) as GithubUser
            // find or create user
            // sign token
            // send result and token
            return result
        } catch (error) {
            return error
        }
    }

    @Cron(CronExpression.EVERY_30_SECONDS)
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
                if (result.access_token) {
                    deviceFlow.destroy()
                }
            } catch (error) {
                const message = (error as Error).message
                if (message === "Failed to fetch") {
                    console.error("Pinging Github for device code: " + deviceFlow.deviceCode)
                    console.error(error)
                }
            }
        })
        return
    }
}
