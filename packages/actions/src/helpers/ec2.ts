import {
    EC2Client, 
    DescribeInstanceStatusCommand,
    RunInstancesCommand, 
    StartInstancesCommand, 
    StopInstancesCommand, 
    TerminateInstancesCommand,
    DescribeInstancesCommand
} from "@aws-sdk/client-ec2"
import { GetCommandInvocationCommand, SSMClient, SendCommandCommand, SendCommandCommandInput } from "@aws-sdk/client-ssm"
import { P0tionEC2Instance } from "../types"
import dotenv from "dotenv"
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
 * Create an SSM client object
 * @returns <Promise<SSMClient>> an SSM client
 */
export const createSSMClient = async (): Promise<SSMClient> => {
    const { accessKeyId, secretAccessKey, region } = getAWSVariables()

    const ssm: SSMClient = new SSMClient({
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey
        },
        region: region
    })

    return ssm
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
):  string[] => {
    const command = [
        "#!/usr/bin/env bash",
        "sudo apt update",
        "sudo apt install awscli -y", // install aws cli 
        "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash", // install nvm
        "source ~/.bashrc",
        "nvm install 16",
        "nvm use 16",
        "npm install -g yarn",
        "npm install -g snarkjs",
        `aws s3 cp s3://${r1csPath} /var/tmp/circuit.r1cs`,
        `aws s3 cp s3://${zKeyPath} /var/tmp/genesisZkey.zkey`,
        `aws s3 cp s3://${ptauPath} /var/tmp/ptau.ptau`,
        "npm install -g p0tion-api",
        "p0tion-api /var/tmp/circuit.r1cs /var/tmp/genesisZkey.zkey /var/tmp/ptau.ptau",
    ]
 
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

// 1. create ssh key in ec2 tab -> save the name 
// 2. IAM role: access to ssh key ("iam:GetSSHPublicKey",)
// 3. IAM role: ec2 access
// 4. ec2 give role for s3 access
// 5. have an api (express) running on the vm 
// 6. have a script that runs on the vm that does the verification
// 7. JWT Authorization: Bearer <token>
// each circuit document needs to have the instance id of the vm 
/*
{
    bucket: "x",
    action: "verify/checkStatus",
    "zKeyIndex": 0,
    "zKeyStoragePath": /circuit/..,
}
*/

/**
 * Creates a new EC2 instance 
 * @param ec2 <EC2Client> the EC2 client to talk to AWS
 * @param commands <string[]> the commands to be run on the EC2 instance
 * @param instanceType <string> the type of instance to be created
 * @param amiId <string> the AMI ID to be used
 * @param keyName <string> the name of the key to be used
 * @param roleArn <string> the ARN of the role to be used
 * @returns <Promise<P0tionEC2Instance>> the instance that was created
 */
export const createEC2Instance = async (
    ec2: EC2Client, 
    commands: string[], 
    instanceType: string,
    amiId: string, 
    keyName: string,
    roleArn: string
    ): Promise<P0tionEC2Instance> => {

    // create the params 
    const params = {
        ImageId: amiId,
        InstanceType: instanceType, // to be determined programmatically
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
    try {
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
    } catch (error: any) {
        console.log("[*] Debug", error)
        throw new Error("Could not deploy a new EC2 instance")
    }
}

/**
 * Check an EC2 instance's status
 * @param ec2Client <EC2Client> the EC2 client to talk to AWS
 * @param instanceId <string> the id of the instance to check
 * @returns <Promise<bool>> the status of the instance
 */
export const checkEC2Status = async (ec2Client: EC2Client, instanceId: string): Promise<boolean> => {
    const command = new DescribeInstanceStatusCommand({
        InstanceIds: [instanceId]
    })
 
    const response = await ec2Client.send(command)
    if (response.$metadata.httpStatusCode !== 200) 
        throw new Error("Could not get the status of the EC2 instance")
        
    return response.InstanceStatuses![0].InstanceState!.Name === "running"
}

/**
 * Get the IP of an EC2 instance
 * @notice the IP will change at every restart
 * @param ec2Client <EC2Client> the EC2 client to talk to AWS
 * @param instanceId <string> the id of the instance to get the IP of
 * @returns <Promise<string>> the IP of the instance
 */
export const getEC2Ip = async (ec2Client: EC2Client, instanceId: string) => {
    const command = new DescribeInstancesCommand({
        InstanceIds: [instanceId]
    })

    const response = await ec2Client.send(command)
    if (response.$metadata.httpStatusCode !== 200) {
        throw new Error("Could not get the IP of the EC2 instance")
    }

    return response.Reservations![0].Instances![0].PublicIpAddress
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

/**
 * Run a command on a VM using SSM
 * @param ssmClient <SSMClient> the SSM client to talk to AWS
 * @param instanceId <string> the id of the instance to run the command on
 * @param commands <string[]> the commands to run
 * @return <Promise<any>> the command id
 */
export const runCommandOnEC2 = async (
    ssmClient: SSMClient, 
    instanceId: string, 
    commands: string[]
    ): Promise<any> => {
    // the params for the command
    const params: SendCommandCommandInput = {
        DocumentName: "AWS-RunShellScript",
        InstanceIds: [instanceId],
        Parameters: {
            "commands": commands
        },
        TimeoutSeconds: 1200
    }

    try {
        const response = await ssmClient.send(new SendCommandCommand(params))
        if (response.$metadata.httpStatusCode !== 200) {
            throw new Error("Could not run the command on the EC2 instance")
        }
        return response.Command!.CommandId
    } catch (error: any) {
        throw new Error("Could not run the command on the EC2 instance")
    }
}

/**
 * Retrieve the output of a SSM command
 * @param ssmClient <SSMClient> the SSM client to talk to AWS
 * @param commandId <string> The id of the command to retrieve the output of
 * @param instanceId <string> The id of the instance to retrieve the output of
 * @return <Promise<any>> The output of the command
 */
export const retrieveCommandOutput = async (
    ssmClient: SSMClient,
    commandId: string,
    instanceId: string 
): Promise<any> => {
    const command = new GetCommandInvocationCommand({
        CommandId: commandId, 
        InstanceId: instanceId
    })

    try {
        const output = await ssmClient.send(command)
        return output.StandardOutputContent
    } catch (error: any) {
        throw new Error("Could not retrieve the output of the command")
    }
}