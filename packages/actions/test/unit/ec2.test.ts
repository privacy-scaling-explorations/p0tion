import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { EC2Client } from "@aws-sdk/client-ec2"
import { sleep } from "../utils"
import {  
    checkEC2Status, 
    createEC2Client, 
    createEC2Instance, 
    getEC2Ip, 
    startEC2Instance, 
    stopEC2Instance, 
    terminateEC2Instance 
} from "../../src/helpers/ec2"
import { P0tionEC2Instance } from "../../src/types"
chai.use(chaiAsPromised)

// @note AWS EC2 on demand VM tests
describe("EC2", () => {
    let instance: P0tionEC2Instance
    let ec2: EC2Client
    let previousIp: string

    beforeAll(async () => {
        ec2 = await createEC2Client()
    })

    it("should create an instance", async () => {
        instance = await createEC2Instance(ec2)
        expect(instance).to.not.be.undefined
        // give it time to actually spin up 
        await sleep(250000)
    })

    it("checkEC2Status should return true for an instance that is running", async () => {
        const response = await checkEC2Status(ec2, instance.InstanceId!)
        expect(response).to.be.true 
    })  

    it("getEC2Ip should return an ip", async () => {
        const ip = await getEC2Ip(ec2, instance.InstanceId!)
        expect(ip).to.not.be.undefined
        previousIp = ip
    })

    it("stopEC2Instance should stop an instance", async () => {
        await expect(stopEC2Instance(ec2, instance.InstanceId!)).to.be.fulfilled
        await sleep(200000)
    })

    it("checkEC2Status should throw for an instance that is stopped", async () => {
        await expect(checkEC2Status(ec2, instance.InstanceId!)).to.be.rejected
    })

    it("startEC2Instance should start an instance", async () => {
        await expect(startEC2Instance(ec2, instance.InstanceId!)).to.be.fulfilled
        await sleep(200000)
    })

    it("should get a different ip address after a restart", async () => {
        const ip = getEC2Ip(ec2, instance.InstanceId!)
        expect(previousIp).to.not.equal(ip)
    })

    it("terminateEC2Instance should terminate an instance", async () => {
        await expect(terminateEC2Instance(ec2, instance.InstanceId!)).to.be.fulfilled
    })
})
