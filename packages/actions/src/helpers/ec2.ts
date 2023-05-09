import {
    EC2Client, 
    DescribeInstanceStatusCommand,
    RunInstancesCommand, 
    StartInstancesCommand, 
    StopInstancesCommand, 
    TerminateInstancesCommand
} from "@aws-sdk/client-ec2"
import { Functions } from "firebase/functions"
import { P0tionEC2Instance } from "../types"
import dotenv from "dotenv"
import { downloadCeremonyArtifact } from "./storage"
import fs from "fs"
dotenv.config()

/**
 * Extract AWS related environment variables
 */
export const getAWSVariables = () => {
    if (
        !process.env.AWS_ACCESS_KEY_ID || 
        !process.env.AWS_SECRET_ACCESS_KEY || 
        !process.env.AWS_ROLE_ARN ||
        !process.env.AWS_AMI_ID ||
        !process.env.AWS_KEY_NAME 
    ) 
        throw new Error("AWS related environment variables are not set. Please check your env file and try again.")

    return {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        region: process.env.AWS_REGION || "us-east-1",
        roleArn: process.env.AWS_ROLE_ARN!,
        amiId: process.env.AWS_AMI_ID!,
        keyName: process.env.AWS_KEY_NAME!
    }
}

/**
 * Create an EC2 client object
 * @returns <Promise<EC2Client>> an EC2 client
 */
export const createEC2Client = async (): Promise<EC2Client> => {
    const { accessKeyId, secretAccessKey, region } = getAWSVariables()

    const ec2: EC2Client = new EC2Client({
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey
        },
        region: region
    })

    return ec2 
}

/**
 * Generate the command to be run by the EC2 instance
 * @param r1csPath <string> path to r1cs file
 * @param zKeyPath <string> path to zkey file
 * @param ptauPath <string> path to ptau file
 * @returns <string[]> array of commands to be run by the EC2 instance
 */
export const generateVMCommand = (
    r1csPath: string, 
    zKeyPath: string, 
    ptauPath: string,
    verificationTranscriptPath: string 
):  string[] => {
    const command = [
        "#!/usr/bin/env bash",
        "sudo apt update",
        "sudo apt install awscli -y", // install cli 
        "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash", // install nvm
        "nvm install 16",
        "nvm use 16",
        "npm install -g snarkjs",
    ]
    command.push(`aws s3 cp s3://${r1csPath} /tmp/circuit.r1cs`)
    command.push(`aws s3 cp s3://${zKeyPath} /tmp/zkey.zkey`)
    command.push(`aws s3 cp s3://${ptauPath} /tmp/ptau.ptau`)
    command.push("snarkjs zkey verify circuit.r1cs ptau.ptau zkey.zkey > /tmp/verify.txt")
    command.push(`aws s3 cp /tmp/verify.txt s3://${verificationTranscriptPath}`)

    return command
}

/**
 * Determine the VM specs based on the circuit constraints (TODO)
 * @param circuitConstraints <string> the constraints of the circuit
 */
export const determineVMSpecs = async (circuitConstraints: string) => {}

// RAM -> instanceId 
const instancesTypes = {
    "t3.nano": {
        RAM: "0.5 GiB",
        VCPU: "2"
    },
    "t3.micro": {
        RAM: "1 GiB",
        VCPU: "2"
    },
    "t3.small": {
        RAM: "2 GiB",
        VCPU: "2"
    },
    "t3.medium": {
        RAM: "4 GiB",
        VCPU: "2"
    },
    "t3.large": {
        RAM: "8 GiB",
        VCPU: "2"
    },
    "t3.xlarge": {
        RAM: "16 GiB",
        VCPU: "4"
    },
    "t3.2xlarge": {
        RAM: "32 GiB",
        VCPU: "8"
    },
    "c5.9xlarge": {
        RAM: "36 GiB",
        VCPU: "36"
    },
    "c5.18xlarge": {
        RAM: "72 GiB",
        VCPU: "72"
    },
    "c5a.8xlarge": {
        RAM: "64 GiB",
        VCPU: "32"
    },
    "c5.12xlarge": {
        RAM: "96 GiB",
        VCPU: "48"
    },
    "c5a.16xlarge": {
        RAM: "128 GiB",
        VCPU: "64"
    },
    "c6i.32xlarge": {
        RAM: "256 GiB",
        VCPU: "128"
    },
    "m6a.32xlarge": {
        RAM: "512 GiB",
        VCPU: "128"
    }
}

/**
 * Creates a new EC2 instance 
 * @param ec2 <EC2Client> the EC2 client to talk to AWS
 * @returns <Promise<P0tionEC2Instance>> the instance that was created
 */
export const createEC2Instance = async (ec2: EC2Client): Promise<P0tionEC2Instance> => {
    const { amiId, keyName, roleArn } = getAWSVariables()
 
    // @note Test only
    const commands = [
        "#!/usr/bin/env bash",
        "sudo apt update",
        "sudo apt install awscli -y",
        "touch /tmp/test.txt",
        "echo 'hello world' > /tmp/test.txt",
        "aws s3 cp /tmp/test.txt s3://p0tion-test-bucket/test.txt"
    ]

    // create the params 
    const params = {
        ImageId: amiId,
        InstanceType: "t2.micro", // to be determined programmatically
        MaxCount: 1,
        MinCount: 1,
        KeyName: keyName,
        // remember how to find this (iam -> roles -> role_name )
        IamInstanceProfile: { 
            Arn: roleArn,
        },
        // how to run commands on startup
        UserData: Buffer.from(commands.join("\n")).toString('base64') 
    }

    // create command 
    const command = new RunInstancesCommand(params)
    const response = await ec2.send(command)

    if (response.$metadata.httpStatusCode !== 200) {
        throw new Error("Could not create a new EC2 instance")
    }

    const instance: P0tionEC2Instance = {
        InstanceId: response.Instances![0].InstanceId!,
        ImageId: response.Instances![0].ImageId!,
        InstanceType: response.Instances![0].InstanceType!,
        KeyName: response.Instances![0].KeyName!,
        LaunchTime: response.Instances![0].LaunchTime!.toISOString()
    }

    return instance
}

/**
 * Check an EC2 instance's status
 * @param ec2Client <EC2Client> the EC2 client to talk to AWS
 * @param instanceId <string> the id of the instance to check
 * @returns <Promise<bool>> the status of the instance
 */
export const checkEC2Status = async (ec2Client: EC2Client, instanceId: string) => {
    const command = new DescribeInstanceStatusCommand({
        InstanceIds: [instanceId]
    })
 
    const response = await ec2Client.send(command)
    if (response.$metadata.httpStatusCode !== 200) {
        throw new Error("Could not get the status of the EC2 instance")
    }
    console.log(response)
    return response.InstanceStatuses![0].InstanceState!.Name === "running"

}

/**
 * Starts an instance that was stopped
 * @param ec2 <EC2Client> the EC2 client to talk to AWS
 * @param instanceId <string> the id of the instance to start
 */
export const startEC2Instance = async (ec2: EC2Client, instanceId: string) => {
    const command = new StartInstancesCommand({
        InstanceIds: [instanceId],
        DryRun: false
    })

    const response = await ec2.send(command)

    if (response.$metadata.httpStatusCode !== 200) {
        throw new Error("Could not start the EC2 instance")
    } 
}

/**
 * Stops an EC2 instance
 * @param ec2 <EC2Client> the EC2 client to talk to AWS
 * @param instanceId <string> the id of the instance to stop
 * @returns 
 */
export const stopEC2Instance = async (ec2: EC2Client, instanceId: string) => {
    const command = new StopInstancesCommand({
        InstanceIds: [instanceId],
        DryRun: false
    })

    const response = await ec2.send(command)

    if (response.$metadata.httpStatusCode !== 200) {
        throw new Error("Could not stop the EC2 instance")
    }
}

/**
 * Terminates an EC2 instance
 * @param ec2 <EC2Client> the EC2 client to talk to AWS
 * @param instanceId <string> the id of the instance to terminate
 */
export const terminateEC2Instance = async (ec2: EC2Client, instanceId: string) => {
    const command = new TerminateInstancesCommand({
        InstanceIds: [instanceId],
        DryRun: false
    })

    const response = await ec2.send(command)

    if (response.$metadata.httpStatusCode !== 200) {
        throw new Error("Could not terminate the EC2 instance")
    }
}

// To retrieve the document from S3 we should time how long it takes to verify a zKey
// idea is to verify the coordinator zKey when a ceremony is setup
// this way we can time that
// and run a cloud function every x minutes 
// or even better we make a script that writes to firestore after the verification is done 
// store the serviceAccountKey in AWS KMS and then use it to write to firestore

/**
 * Retrieves the verification result
 * @param userFunctions <Functions> the Firebase functions
 * @param bucketName <string> the name of the bucket
 * @param verificationTranscriptPath <string> the path to the verification transcript
 */
export const getVerificationResult = async (userFunctions: Functions, bucketName: string, verificationTranscriptPath: string) => {
    const filePath = "/tmp/verification.txt"
    // download the file
    await downloadCeremonyArtifact(userFunctions, bucketName, verificationTranscriptPath, filePath)

    const pattern = "ZKey Ok!"
    const fileData = fs.readFileSync(filePath, "utf-8").toString()

    // delete the file
    fs.unlinkSync(filePath)

    // a successful verification file will have written "Zkey Ok!"
    if (fileData.includes(pattern)) return true 
    // we need to make sure to delete the artifacts
    return false 
}