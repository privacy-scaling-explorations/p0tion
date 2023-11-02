import {
    DescribeInstanceStatusCommand,
    RunInstancesCommand,
    StartInstancesCommand,
    StopInstancesCommand,
    TerminateInstancesCommand,
    EC2Client,
    RunInstancesCommandInput
} from "@aws-sdk/client-ec2"
import {
    GetCommandInvocationCommand,
    SSMClient,
    SendCommandCommand,
    SendCommandCommandInput
} from "@aws-sdk/client-ssm"
import dotenv from "dotenv"
import { DiskTypeForVM } from "src"
import { EC2Instance } from "../types"
import { convertBytesOrKbToGb } from "./utils"
import { ec2InstanceTag, powersOfTauFiles, vmBootstrapScriptFilename } from "./constants"
import { getAWSVariables } from "./services"

dotenv.config()

/**
 * Create a new AWS EC2 client.
 * @returns <Promise<EC2Client>> - the EC2 client instance.
 */
export const createEC2Client = async (): Promise<EC2Client> => {
    // Get the AWS variables.
    const { accessKeyId, secretAccessKey, region } = getAWSVariables()

    // Instantiate the new client.
    return new EC2Client({
        credentials: {
            accessKeyId,
            secretAccessKey
        },
        region
    })
}

/**
 * Create a new AWS SSM client.
 * @returns <Promise<SSMClient>> - the SSM client instance.
 */
export const createSSMClient = async (): Promise<SSMClient> => {
    // Get the AWS variables.
    const { accessKeyId, secretAccessKey, region } = getAWSVariables()

    // Instantiate the new client.
    return new SSMClient({
        credentials: {
            accessKeyId,
            secretAccessKey
        },
        region
    })
}

/**
 * Return the list of bootstrap commands to be executed.
 * @dev the startup commands must be suitable for a shell script.
 * @param bucketName <string> - the name of the AWS S3 bucket.
 * @returns <Array<string>> - the list of startup commands to be executed.
 */
export const vmBootstrapCommand = (bucketName: string): Array<string> => [
    "#!/bin/bash", // shabang.
    `aws s3 cp s3://${bucketName}/${vmBootstrapScriptFilename} ${vmBootstrapScriptFilename}`, // copy file from S3 bucket to VM.
    `chmod +x ${vmBootstrapScriptFilename} && bash ${vmBootstrapScriptFilename}` // grant permission and execute.
]

/**
 * Return the list of Node environment (and packages) installation plus artifact caching for contribution verification.
 * @param zKeyPath <string> - the path to zKey artifact inside AWS S3 bucket.
 * @param potPath <string> - the path to ptau artifact inside AWS S3 bucket.
 * @param snsTopic <string> - the SNS topic ARN.
 * @param region <string> - the AWS region.
 * @returns <Array<string>> - the array of commands to be run by the EC2 instance.
 */
export const vmDependenciesAndCacheArtifactsCommand = (
    zKeyPath: string,
    potPath: string,
    snsTopic: string,
    region: string
): Array<string> => [
    "#!/bin/bash",
    'MARKER_FILE="/var/run/my_script_ran"',
    // eslint-disable-next-line no-template-curly-in-string
    "if [ -e ${MARKER_FILE} ]; then",
    "exit 0",
    "else",
    // eslint-disable-next-line no-template-curly-in-string
    "touch ${MARKER_FILE}",
    "sudo yum update -y",
    "curl -O https://nodejs.org/dist/v16.13.0/node-v16.13.0-linux-x64.tar.xz",
    "tar -xf node-v16.13.0-linux-x64.tar.xz",
    "mv node-v16.13.0-linux-x64 nodejs",
    "sudo mv nodejs /opt/",
    "echo 'export NODEJS_HOME=/opt/nodejs' >> /etc/profile",
    "echo 'export PATH=$NODEJS_HOME/bin:$PATH' >> /etc/profile",
    "source /etc/profile",
    "npm install -g snarkjs",
    `aws s3 cp s3://${zKeyPath} /var/tmp/genesisZkey.zkey`,
    `aws s3 cp s3://${potPath} /var/tmp/pot.ptau`,
    "wget https://github.com/BLAKE3-team/BLAKE3/releases/download/1.4.0/b3sum_linux_x64_bin -O /var/tmp/blake3.bin",
    "chmod +x /var/tmp/blake3.bin",
    "INSTANCE_ID=$(ec2-metadata -i | awk '{print $2}')",
    `aws sns publish --topic-arn ${snsTopic} --message "$INSTANCE_ID" --region ${region}`,
    "fi"
]

/**
 * Return the list of commands for contribution verification.
 * @dev this method generates the verification transcript as well.
 * @param bucketName <string> - the name of the AWS S3 bucket.
 * @param lastZkeyStoragePath <string> - the last zKey storage path.
 * @param verificationTranscriptStoragePathAndFilename <string> - the verification transcript storage path.
 * @returns Array<string> - the list of commands for contribution verification.
 */
export const vmContributionVerificationCommand = (
    bucketName: string,
    lastZkeyStoragePath: string,
    verificationTranscriptStoragePathAndFilename: string
): Array<string> => [
    `source /etc/profile`,
    `aws s3 cp s3://${bucketName}/${lastZkeyStoragePath} /var/tmp/lastZKey.zkey > /var/tmp/log.txt`,
    `snarkjs zkvi /var/tmp/genesisZkey.zkey /var/tmp/pot.ptau /var/tmp/lastZKey.zkey > /var/tmp/verification_transcript.log`,
    `aws s3 cp /var/tmp/verification_transcript.log s3://${bucketName}/${verificationTranscriptStoragePathAndFilename} &>/dev/null`,
    `/var/tmp/blake3.bin /var/tmp/verification_transcript.log | awk '{print $1}'`,
    `rm /var/tmp/lastZKey.zkey /var/tmp/verification_transcript.log /var/tmp/log.txt &>/dev/null`
]

/**
 * Compute the VM disk size.
 * @dev the disk size is computed using the zKey size in bytes taking into consideration
 * the verification task (2 * zKeySize) + ptauSize + OS/VM (~8GB).
 * @param zKeySizeInBytes <number> the size of the zKey in bytes.
 * @param pot <number> the amount of powers needed for the circuit (index of the PPoT file).
 * @return <number> the configuration of the VM disk size in GB.
 */
export const computeDiskSizeForVM = (zKeySizeInBytes: number, pot: number): number =>
    Math.ceil(2 * convertBytesOrKbToGb(zKeySizeInBytes, true) + powersOfTauFiles[pot - 1].size) + 8

/**
 * Creates a new EC2 instance
 * @param ec2 <EC2Client> - the instance of the EC2 client.
 * @param commands <Array<string>> - the list of commands to be run on the EC2 instance.
 * @param instanceType <string> - the type of the EC2 VM instance.
 * @param diskSize <number> - the size of the disk (volume) of the VM.
 * @param diskType <DiskTypeForVM> - the type of the disk (volume) of the VM.
 * @returns <Promise<P0tionEC2Instance>> the instance that was created
 */
export const createEC2Instance = async (
    ec2: EC2Client,
    commands: string[],
    instanceType: string,
    volumeSize: number,
    diskType: DiskTypeForVM
): Promise<EC2Instance> => {
    // Get the AWS variables.
    const { amiId, instanceProfileArn } = getAWSVariables()

    // Parametrize the VM EC2 instance.
    const params: RunInstancesCommandInput = {
        ImageId: amiId,
        InstanceType: instanceType,
        MaxCount: 1,
        MinCount: 1,
        // nb. to find this: iam -> roles -> role_name.
        IamInstanceProfile: {
            Arn: instanceProfileArn
        },
        // nb. for running commands at the startup.
        UserData: Buffer.from(commands.join("\n")).toString("base64"),
        BlockDeviceMappings: [
            {
                DeviceName: "/dev/xvda",
                Ebs: {
                    DeleteOnTermination: true,
                    VolumeSize: volumeSize, // disk size in GB.
                    VolumeType: diskType
                }
            }
        ],
        // tag the resource
        TagSpecifications: [
            {
                ResourceType: "instance",
                Tags: [
                    {
                        Key: "Name",
                        Value: ec2InstanceTag
                    },
                    {
                        Key: "Initialized",
                        Value: "false"
                    }
                ]
            }
        ]
    }

    try {
        // Create a new command instance.
        const command = new RunInstancesCommand(params)
        // Send the command for execution.
        const response = await ec2.send(command)

        if (response.$metadata.httpStatusCode !== 200)
            throw new Error(`Something went wrong when creating the EC2 instance. More details ${response}`)

        // Create a new EC2 VM instance.
        return {
            instanceId: response.Instances![0].InstanceId!,
            imageId: response.Instances![0].ImageId!,
            instanceType: response.Instances![0].InstanceType!,
            keyName: response.Instances![0].KeyName!,
            launchTime: response.Instances![0].LaunchTime!.toISOString()
        }
    } catch (error: any) {
        throw new Error(`Something went wrong when creating the EC2 instance. More details ${error}`)
    }
}

/**
 * Check if the current VM EC2 instance is running by querying the status.
 * @param ec2 <EC2Client> - the instance of the EC2 client.
 * @param instanceId <string> - the unique identifier of the EC2 VM instance.
 * @returns <Promise<boolean>> - true if the current status of the EC2 VM instance is 'running'; otherwise false.
 */
export const checkIfRunning = async (ec2Client: EC2Client, instanceId: string): Promise<boolean> => {
    // Generate a new describe status command.
    const command = new DescribeInstanceStatusCommand({
        InstanceIds: [instanceId]
    })

    // Run the command.
    const response = await ec2Client.send(command)

    if (response.$metadata.httpStatusCode !== 200)
        throw new Error(
            `Something went wrong when retrieving the EC2 instance (${instanceId}) status. More details ${response}`
        )

    return response.InstanceStatuses![0].InstanceState!.Name === "running"
}

/**
 * Start an EC2 VM instance.
 * @dev the instance must have been created previously.
 * @param ec2 <EC2Client> - the instance of the EC2 client.
 * @param instanceId <string> - the unique identifier of the EC2 VM instance.
 */
export const startEC2Instance = async (ec2: EC2Client, instanceId: string) => {
    // Generate a new start instance command.
    const command = new StartInstancesCommand({
        InstanceIds: [instanceId],
        DryRun: false
    })

    // Run the command.
    const response = await ec2.send(command)

    if (response.$metadata.httpStatusCode !== 200)
        throw new Error(`Something went wrong when starting the EC2 instance (${instanceId}). More details ${response}`)
}

/**
 * Stop an EC2 VM instance.
 * @dev the instance must have been in a running status.
 * @param ec2 <EC2Client> - the instance of the EC2 client.
 * @param instanceId <string> - the unique identifier of the EC2 VM instance.
 */
export const stopEC2Instance = async (ec2: EC2Client, instanceId: string) => {
    // Generate a new stop instance command.
    const command = new StopInstancesCommand({
        InstanceIds: [instanceId],
        DryRun: false
    })

    // Run the command.
    const response = await ec2.send(command)

    if (response.$metadata.httpStatusCode !== 200)
        throw new Error(`Something went wrong when stopping the EC2 instance (${instanceId}). More details ${response}`)
}

/**
 * Terminate an EC2 VM instance.
 * @param ec2 <EC2Client> - the instance of the EC2 client.
 * @param instanceId <string> - the unique identifier of the EC2 VM instance.
 */
export const terminateEC2Instance = async (ec2: EC2Client, instanceId: string) => {
    // Generate a new terminate instance command.
    const command = new TerminateInstancesCommand({
        InstanceIds: [instanceId],
        DryRun: false
    })

    // Run the command.
    const response = await ec2.send(command)

    if (response.$metadata.httpStatusCode !== 200)
        throw new Error(
            `Something went wrong when terminating the EC2 instance (${instanceId}). More details ${response}`
        )
}

/**
 * Run a command on an EC2 VM instance by using SSM.
 * @dev this method returns the command identifier for checking the status and retrieve
 * the output of the command execution later on.
 * @param ssm <SSMClient> - the instance of the sSM client.
 * @param instanceId <string> - the unique identifier of the EC2 VM instance.
 * @param commands <Array<string>> - the list of commands.
 * @return <Promise<string>> - the unique identifier of the command.
 */
export const runCommandUsingSSM = async (
    ssm: SSMClient,
    instanceId: string,
    commands: Array<string>
): Promise<string> => {
    // Generate a new send command input command.
    const params: SendCommandCommandInput = {
        DocumentName: "AWS-RunShellScript",
        InstanceIds: [instanceId],
        Parameters: {
            commands
        },
        TimeoutSeconds: 1200
    }

    try {
        // Run the command.
        const response = await ssm.send(new SendCommandCommand(params))

        // if (response.$metadata.httpStatusCode !== 200)
        //     throw new Error(
        //         `Something went wrong when trying to run a command on the EC2 instance (${instanceId}). More details ${response}`
        //     )

        return response.Command!.CommandId!
    } catch (error: any) {
        throw new Error(`Something went wrong when trying to run a command on the EC2 instance. More details ${error}`)
    }
}

/**
 * Get the output of an SSM command executed on an EC2 VM instance.
 * @param ssm <SSMClient> - the instance of the sSM client.
 * @param instanceId <string> - the unique identifier of the EC2 VM instance.
 * @param commandId <string> - the unique identifier of the command.
 * @return <Promise<string>> - the command output.
 */
export const retrieveCommandOutput = async (ssm: SSMClient, instanceId: string, commandId: string): Promise<string> => {
    // Generate a new get command invocation command.
    const command = new GetCommandInvocationCommand({
        CommandId: commandId,
        InstanceId: instanceId
    })

    try {
        // Run the command.
        const response = await ssm.send(command)

        return response.StandardOutputContent!
    } catch (error: any) {
        throw new Error(
            `Something went wrong when trying to retrieve the command ${commandId} output on the EC2 instance (${instanceId}). More details ${error}`
        )
    }
}

/**
 * Get the status of an SSM command executed on an EC2 VM instance.
 * @param ssm <SSMClient> - the instance of the sSM client.
 * @param instanceId <string> - the unique identifier of the EC2 VM instance.
 * @param commandId <string> - the unique identifier of the command.
 * @return <Promise<string>> - the command status.
 */
export const retrieveCommandStatus = async (ssm: SSMClient, instanceId: string, commandId: string): Promise<string> => {
    // Generate a new get command invocation command.
    const command = new GetCommandInvocationCommand({
        CommandId: commandId,
        InstanceId: instanceId
    })

    try {
        // Run the command.
        const response = await ssm.send(command)
        return response.Status!
    } catch (error: any) {
        throw new Error(
            `Something went wrong when trying to retrieve the command ${commandId} status on the EC2 instance (${instanceId}). More details ${error}`
        )
    }
}
