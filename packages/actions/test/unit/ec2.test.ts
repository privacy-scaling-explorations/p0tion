import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { EC2Client } from "@aws-sdk/client-ec2"
import fetch from "@adobe/node-fetch-retry"
import { createMockUser, envType, generateUserPasswords, getStorageConfiguration, getTranscriptLocalFilePath, initializeAdminServices, initializeUserServices, sleep } from "../utils"
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
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth"
import { SSMClient } from "@aws-sdk/client-ssm"
import { TestingEnvironment, checkParticipantForCeremony, commonTerms, createCustomLoggerForFile, createS3Bucket, formatZkeyIndex, generateGetObjectPreSignedUrl, genesisZkeyIndex, getBucketName, getCeremonyCircuits, getCircuitBySequencePosition, getCircuitsCollectionPath, getDocumentById, getParticipantsCollectionPath, getPotStorageFilePath, getZkeyStorageFilePath, multiPartUpload, permanentlyStoreCurrentContributionTimeAndHash, progressToNextCircuitForContribution, progressToNextContributionStep, setupCeremony, verifyContribution } from "../../src"
import { cwd } from "process"
import fs from "fs"
import { zKey } from "snarkjs"
import { randomBytes } from "crypto"
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

    describe("EC2", () => {
        it("should create an instance", async () => {
            instance = await createEC2Instance(ec2, [
                "echo 'hello world' > hello.txt",
                "aws s3 cp hello.txt s3://p0tion-test-bucket/hello.txt"
            ], "t2.micro", amiId, keyName, roleArn)
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
            previousIp = ip!
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

    describe("SSM", () => {
        let ssmClient: SSMClient 
        let commandId: string 
        let ssmTestInstance: P0tionEC2Instance
        beforeAll(async () => {
            ssmClient = await createSSMClient()
            const userData = [
                    "#!/bin/bash",
                    "aws s3 cp s3://p0tion-test-bucket/script_test.sh script_test.sh",
                    "chmod +x script_test.sh && bash script_test.sh"
            ]
            ssmTestInstance = await createEC2Instance(ec2, userData, "t2.small", amiId, keyName, roleArn)
            await sleep(250000)
        })
        it("should run my commands", async () => {
            await runCommandOnEC2(ssmClient, ssmTestInstance.InstanceId, [
                `pwd`
            ] )
            
        })
        it("run a command on a VM that is active", async () => {
            commandId = await runCommandOnEC2(ssmClient, ssmTestInstance.InstanceId!, [
                "echo $(whoami) >> hello.txt"
            ])
            expect(commandId).to.not.be.null 
            await sleep(500)
        })
        it("should run multiple commands", async () => {
            await runCommandOnEC2(ssmClient, ssmTestInstance.InstanceId!, [
                "su ubuntu", "whoami", "id", "pwd", "ls -la", "ls -la /root", "ls -la /home/ubuntu",
            ])
        })
        it("should throw when trying to call a command on a VM that is not active", async () => {
            await expect(runCommandOnEC2(ssmClient, "nonExistentOrOff", ["echo hello world"])).to.be.rejected
        })
        it("should retrieve the output of a command", async () => {
            await sleep(20000)
            const output = await retrieveCommandOutput(ssmClient, commandId, ssmTestInstance.InstanceId!)
            expect(output.length).to.be.gt(0)
        })
        it("should throw when trying to retrieve the output of a non existent command", async () => {
            await expect(retrieveCommandOutput(ssmClient, "nonExistentCommand", ssmTestInstance.InstanceId!)).to.be.rejected
        })
        afterAll(async () => {
            await terminateEC2Instance(ec2, ssmTestInstance.InstanceId!)
        })
    })

    afterAll(async () => {
        await terminateEC2Instance(ec2, instance.InstanceId!)
    })

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

        const zkeyPath = `${cwd()}/packages/actions/test/data/artifacts/circuit_0000.zkey`
        const potPath = `${cwd()}/packages/actions/test/data/artifacts/powersOfTau28_hez_final_02.ptau`
        let storagePath = getZkeyStorageFilePath(
            circuit.data.prefix!,
            `${circuit.data.prefix}_${genesisZkeyIndex}.zkey`
        )
    
        const potStoragePath = getPotStorageFilePath(circuit.data.files?.potFilename!)
        const outputDirectory = `${cwd()}/packages/actions/test/data/artifacts/output`

        if (envType === TestingEnvironment.PRODUCTION) {
            // create dir structure
            fs.mkdirSync(`${outputDirectory}/contribute/attestation`, { recursive: true })
            fs.mkdirSync(`${outputDirectory}/contribute/transcripts`, { recursive: true })
            fs.mkdirSync(`${outputDirectory}/contribute/zkeys`, { recursive: true })

        }

        // s3 objects we have to delete
        const objectsToDelete = [potStoragePath, storagePath]

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


            // zkey upload
            await multiPartUpload(userFunctions, ceremonyBucket, storagePath, zkeyPath, streamChunkSizeInMb)
            // pot upload
            await multiPartUpload(userFunctions, ceremonyBucket, potStoragePath, potPath, streamChunkSizeInMb)
            await signOut(userAuth)
        })

        afterAll(async () => {
            for (const instanceId of instancesToTerminate) {
                await terminateEC2Instance(ec2, instanceId)
            }
        })

        it.skip("should create a ceremony and two VMs should spin up", async () => {
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

        it.skip("should verify a contribution", async () => {
            // 1. login as user 2
            await signInWithEmailAndPassword(userAuth, users[2].data.email, passwords[2])
            await sleep(500)
            // 2. get circuits for ceremony
            const circuits = await getCeremonyCircuits(userFirestore, ceremonyId)
            expect(circuits.length).to.be.gt(0)

            // 3. register for cermeony
            const canParticipate = await checkParticipantForCeremony(userFunctions, ceremonyId)
            expect(canParticipate).to.be.true

            // 4. entropy
            const entropy = randomBytes(32).toString("hex")

            // 5. get circuit to contribute to
            const circuit = getCircuitBySequencePosition(circuits, 1)
            expect(circuit).not.be.null

            // 6. get circuit data
            const currentProgress = circuit.data.waitingQueue.completedContributions
            const currentZkeyIndex = formatZkeyIndex(currentProgress)
            const nextZkeyIndex = formatZkeyIndex(currentProgress + 1)

            // 7. download previous contribution
            storagePath = getZkeyStorageFilePath(circuit.data.prefix, `${circuit.data.prefix}_${currentZkeyIndex}.zkey`)

            const lastZkeyLocalFilePath = `${outputDirectory}/contribute/zkeys/${circuit.data.prefix}_${currentZkeyIndex}.zkey`
            const nextZkeyLocalFilePath = `${outputDirectory}/contribute/zkeys/${circuit.data.prefix}_${nextZkeyIndex}.zkey`

            const preSignedUrl = await generateGetObjectPreSignedUrl(userFunctions, ceremonyBucket, storagePath)
            // @ts-ignore
            const getResponse = await fetch(preSignedUrl)
            await sleep(500)
            // Write the file to disk.
            fs.writeFileSync(lastZkeyLocalFilePath, await getResponse.buffer())
            await sleep(500)
            // 9. progress to next step
            await progressToNextCircuitForContribution(userFunctions, ceremonyId)
            await sleep(1000)

            const transcriptLocalFilePath = `${outputDirectory}/${getTranscriptLocalFilePath(
                `${circuit.data.prefix}_${nextZkeyIndex}.log`
            )}`
            const transcriptLogger = createCustomLoggerForFile(transcriptLocalFilePath)
            // 10. do contribution
            await zKey.contribute(lastZkeyLocalFilePath, nextZkeyLocalFilePath, users[2].uid, entropy, transcriptLogger)
            await sleep(1000)

            // read the contribution hash
            const transcriptContents = fs.readFileSync(transcriptLocalFilePath, "utf-8").toString()
            const matchContributionHash = transcriptContents.match(/Contribution.+Hash.+\n\t\t.+\n\t\t.+\n.+\n\t\t.+\n/)
            const contributionHash = matchContributionHash?.at(0)?.replace("\n\t\t", "")!

            await progressToNextContributionStep(userFunctions, ceremonyId)
            await sleep(2000)
            await permanentlyStoreCurrentContributionTimeAndHash(
                userFunctions,
                ceremonyId,
                new Date().valueOf(),
                contributionHash
            )
            await sleep(2000)

            await progressToNextContributionStep(userFunctions, ceremonyId)
            await sleep(1000)

            const participant = await getDocumentById(
                userFirestore,
                getParticipantsCollectionPath(ceremonyId),
                users[2].uid
            )

            // Upload
            const nextZkeyStoragePath = getZkeyStorageFilePath(
                circuit.data.prefix,
                `${circuit.data.prefix}_${nextZkeyIndex}.zkey`
            )
            await multiPartUpload(
                userFunctions,
                ceremonyBucket,
                nextZkeyStoragePath,
                nextZkeyLocalFilePath,
                streamChunkSizeInMb,
                ceremony.uid,
                participant.data()!.tempContributionData
            )
            await sleep(1000)

            objectsToDelete.push(nextZkeyStoragePath)

            // Execute contribution verification.
            const tempCircuit = await getDocumentById(
                userFirestore,
                getCircuitsCollectionPath(ceremonyId),
                circuit.id
            )

            await verifyContribution(
                userFunctions,
                ceremonyId,
                tempCircuit,
                ceremonyBucket,
                users[2].uid,
                String(process.env.FIREBASE_CF_URL_VERIFY_CONTRIBUTION)
            )
        })
    })
})
