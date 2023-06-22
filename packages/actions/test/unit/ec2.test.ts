import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { EC2Client } from "@aws-sdk/client-ec2"
import { createMockUser, generateUserPasswords, getStorageConfiguration, initializeAdminServices, initializeUserServices, sleep } from "../utils"
import {  
    checkEC2Status, 
    createEC2Client, 
    createEC2Instance, 
    createSSMClient, 
    getAWSVariables, 
    getEC2Ip, 
    retrieveCommandOutput, 
    runCommandOnEC2, 
    startEC2Instance, 
    stopEC2Instance, 
    terminateEC2Instance 
} from "../../src/helpers/ec2"
import { P0tionEC2Instance } from "../../src/types"
import { fakeCeremoniesData, fakeCircuitsData, fakeUsersData } from "../data/samples"
import { getAuth, signInWithEmailAndPassword } from "firebase/auth"
import { SSMClient } from "@aws-sdk/client-ssm"
import { commonTerms, createS3Bucket, getBucketName, getCeremonyCircuits, getDocumentById, setupCeremony } from "../../src"
chai.use(chaiAsPromised)

// @note AWS EC2 on demand VM tests
describe("VMs", () => {
    let instance: P0tionEC2Instance
    let ec2: EC2Client
    let previousIp: string

    const { amiId, keyName, roleArn } = getAWSVariables() 

    beforeAll(async () => {
        ec2 = await createEC2Client()
    })

    // describe("EC2", () => {
    //     it("should create an instance", async () => {
    //         instance = await createEC2Instance(ec2, [], "t2.micro", amiId, keyName, roleArn)
    //         expect(instance).to.not.be.undefined
    //         // give it time to actually spin up 
    //         await sleep(250000)
    //     })
    
    //     it("checkEC2Status should return true for an instance that is running", async () => {
    //         const response = await checkEC2Status(ec2, instance.InstanceId!)
    //         expect(response).to.be.true 
    //     })  
    
    //     it("getEC2Ip should return an ip", async () => {
    //         const ip = await getEC2Ip(ec2, instance.InstanceId!)
    //         expect(ip).to.not.be.undefined
    //         previousIp = ip!
    //     })
    
    //     it("stopEC2Instance should stop an instance", async () => {
    //         await expect(stopEC2Instance(ec2, instance.InstanceId!)).to.be.fulfilled
    //         await sleep(200000)
    //     })
    
    //     it("checkEC2Status should throw for an instance that is stopped", async () => {
    //         await expect(checkEC2Status(ec2, instance.InstanceId!)).to.be.rejected
    //     })
    
    //     it("startEC2Instance should start an instance", async () => {
    //         await expect(startEC2Instance(ec2, instance.InstanceId!)).to.be.fulfilled
    //         await sleep(200000)
    //     })
    
    //     it("should get a different ip address after a restart", async () => {
    //         const ip = getEC2Ip(ec2, instance.InstanceId!)
    //         expect(previousIp).to.not.equal(ip)
    //     })
    
    //     it("terminateEC2Instance should terminate an instance", async () => {
    //         await expect(terminateEC2Instance(ec2, instance.InstanceId!)).to.be.fulfilled
    //     })
    // })

    // describe("SSM", () => {
    //     let ssmClient: SSMClient 
    //     let commandId: string 
    //     let ssmTestInstance: P0tionEC2Instance
    //     beforeAll(async () => {
    //         ssmClient = await createSSMClient()
    //         ssmTestInstance = await createEC2Instance(ec2, [], "t2.micro", amiId, keyName, roleArn)
    //         await sleep(250000)
    //     })
    //     it("run a command on a VM that is active", async () => {
    //         commandId = await runCommandOnEC2(ssmClient, instance.InstanceId!, ["ls -la"])
    //         expect(commandId).to.not.be.null 
    //         await sleep(500)
    //     })
    //     it("should throw when trying to call a command on a VM that is not active", async () => {
    //         await expect(runCommandOnEC2(ssmClient, "nonExistentOrOff", ["echo hello world"])).to.be.rejected
    //     })
    //     it("shuold retrieve the output of a command", async () => {
    //         await sleep(20000)
    //         const output = await retrieveCommandOutput(ssmClient, commandId, instance.InstanceId!)
    //         expect(output.length).to.be.gt(0)
    //     })
    //     it("should throw when trying to retrieve the output of a non existent command", async () => {
    //         await expect(retrieveCommandOutput(ssmClient, "nonExistentCommand", instance.InstanceId!)).to.be.rejected
    //     })
    //     afterAll(async () => {
    //         await terminateEC2Instance(ec2, ssmTestInstance.InstanceId!)
    //     })
    // })

    // afterAll(async () => {
    //     await terminateEC2Instance(ec2, instance.InstanceId!)
    // })

    describe("Setup a ceremony that uses two VMs", () => {
        // Sample data for running the test.
        const users = [fakeUsersData.fakeUser1, fakeUsersData.fakeUser2]
        const passwords = generateUserPasswords(2)

        // Initialize user and admin services.
        const { userApp, userFunctions, userFirestore } = initializeUserServices()
        const { adminFirestore, adminAuth } = initializeAdminServices()
        const userAuth = getAuth(userApp)

         // Get configs for storage.
        const { ceremonyBucketPostfix, streamChunkSizeInMb } = getStorageConfiguration()
        const ceremony = fakeCeremoniesData.fakeCeremonyScheduledDynamic
        const ceremonyBucket = getBucketName(ceremony.data.prefix, ceremonyBucketPostfix)
        const circuit = fakeCircuitsData.fakeCircuitSmallNoContributors

        let ceremonyId: string 
        const instancesToTerminate: string[] = []

        beforeAll(async () => {
            // create 2 users the second is the coordinator
            for (let i = 0; i < 2; i++) {
                users[i].uid = await createMockUser(
                    userApp,
                    users[i].data.email,
                    passwords[i],
                    i === passwords.length - 1,
                    adminAuth
                )
            }

            // 1 create a bucket for the ceremony
            await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
            await createS3Bucket(userFunctions, ceremonyBucket)
        })

        afterAll(async () => {
            for (const instanceId of instancesToTerminate) {
                await terminateEC2Instance(ec2, instanceId)
            }
        })

        it("should create a ceremony and two VMs should spin up", async () => {
            // 1. setup ceremony
            ceremonyId = await setupCeremony(userFunctions, ceremony.data, ceremony.data.prefix!, [circuit.data])

            // 2. confirm
            const ceremonyDoc = await getDocumentById(
                userFirestore,
                commonTerms.collections.ceremonies.name,
                ceremonyId
            )

            const circuits = await getCeremonyCircuits(userFirestore, ceremonyDoc.id)
            
            for (const circuit of circuits) {
                const { vmInstanceId } = circuit.data.vmInstanceId
                instancesToTerminate.push(vmInstanceId)
                // check VM status
                const status = await checkEC2Status(ec2, vmInstanceId)
                expect(status).to.be.eq(true)
            }
        })

        it("should verify a contribution", async () => {})
    })
})
