import { EC2Client, DescribeInstancesCommand, StopInstancesCommand, CreateTagsCommand } from "@aws-sdk/client-ec2";

const ec2 = new EC2Client({ region: 'us-east-1' });

export const handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // Extract the SNS message which will be the instanceId
    const instanceId = event.Records[0].Sns.Message;

    // Get information about the instance
    const params = {
        InstanceIds: [instanceId]
    };

    try {
        const describeInstancesCommand = new DescribeInstancesCommand(params)
        let data = await ec2.send(describeInstancesCommand)
        const instance = data.Reservations[0].Instances[0]

        // Check if the instance has the "p0tionec2instance" name tag
        const hasCorrectNameTag = instance.Tags.some(tag => tag.Key === 'Name' && tag.Value === 'p0tionec2instance')
        // Check if the instance has been already initialized
        const alreadyInitialized = instance.Tags.some(tag => tag.Key === 'Initialized' && tag.Value === 'true')

        if (hasCorrectNameTag && !alreadyInitialized) {
            // If the instance has the correct name tag and it is not initialized yet, stop it
            const stopInstancesCommand = new StopInstancesCommand(params)
            data = await ec2.send(stopInstancesCommand)
            console.log('StopInstances succeeded:', data)

            // Mark the instance as initialized
            const createTagsCommand = new CreateTagsCommand({
                Resources: [instanceId],
                Tags: [
                    {
                        Key: 'Initialized',
                        Value: 'true'
                    }
                ]
            })
            await ec2.send(createTagsCommand)
            console.log(`Instance ${instanceId} has been marked as initialized.`)
        } else {
            console.log(`Instance ${instanceId} does not meet the requirements, ignoring...`)
        }
    } catch (err) {
        console.log('Error', err)
    }
}
