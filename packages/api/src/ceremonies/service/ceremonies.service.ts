import { Injectable } from "@nestjs/common"
import { CeremonyDto } from "../dto/ceremony-dto"
import { InjectModel } from "@nestjs/sequelize"
import { CeremonyEntity } from "../entities/ceremony.entity"
import { CircuitEntity } from "../entities/circuit.entity"
import { CircuitDto } from "../dto/circuit-dto"
import {
    CircuitContributionVerificationMechanism,
    computeDiskSizeForVM,
    createEC2Instance,
    getBucketName,
    vmBootstrapCommand,
    vmBootstrapScriptFilename,
    vmDependenciesAndCacheArtifactsCommand
} from "@p0tion/actions"
import { createEC2Client, getAWSVariables, uploadFileToBucketNoFile } from "src/lib/utils"
import { COMMON_ERRORS, SPECIFIC_ERRORS, logAndThrowError, makeError, printLog } from "src/lib/errors"
import { LogLevel } from "src/types/enums"
import { getS3Client } from "src/lib/services"
import {
    CreateBucketCommand,
    HeadBucketCommand,
    PutBucketCorsCommand,
    PutPublicAccessBlockCommand
} from "@aws-sdk/client-s3"

@Injectable()
export class CeremoniesService {
    constructor(
        @InjectModel(CeremonyEntity)
        private ceremonyModel: typeof CeremonyEntity,
        @InjectModel(CircuitEntity)
        private circuitModel: typeof CircuitEntity
    ) {}

    async createBucket(ceremonyPrefix: string) {
        const bucketName = getBucketName(ceremonyPrefix, String(process.env.AWS_CEREMONY_BUCKET_POSTFIX))
        const S3 = await getS3Client()
        try {
            // Try to get information about the bucket.
            await S3.send(new HeadBucketCommand({ Bucket: bucketName }))
            // If the command succeeded, the bucket exists, throw an error.
            logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_INVALID_BUCKET_NAME)
        } catch (error: any) {
            if (error.name === "NotFound") {
                // Prepare S3 command.
                const command = new CreateBucketCommand({
                    Bucket: bucketName,
                    // CreateBucketConfiguration: {
                    //     LocationConstraint: String(process.env.AWS_REGION)
                    // },
                    ObjectOwnership: "BucketOwnerPreferred"
                })
                try {
                    // Execute S3 command.
                    const response = await S3.send(command)
                    // Check response.
                    if (response.$metadata.httpStatusCode === 200 && !!response.Location)
                        printLog(`The AWS S3 bucket ${bucketName} has been created successfully`, LogLevel.LOG)

                    const publicBlockCommand = new PutPublicAccessBlockCommand({
                        Bucket: bucketName,
                        PublicAccessBlockConfiguration: {
                            BlockPublicAcls: false,
                            BlockPublicPolicy: false
                        }
                    })

                    // Allow objects to be public
                    const publicBlockResponse = await S3.send(publicBlockCommand)
                    // Check response.
                    if (publicBlockResponse.$metadata.httpStatusCode === 204)
                        printLog(
                            `The AWS S3 bucket ${bucketName} has been set with the PublicAccessBlock disabled.`,
                            LogLevel.LOG
                        )

                    // Set CORS
                    const corsCommand = new PutBucketCorsCommand({
                        Bucket: bucketName,
                        CORSConfiguration: {
                            CORSRules: [
                                {
                                    AllowedMethods: ["GET", "PUT"],
                                    AllowedOrigins: ["*"],
                                    ExposeHeaders: ["ETag", "Content-Length"],
                                    AllowedHeaders: ["*"]
                                }
                            ]
                        }
                    })
                    const corsResponse = await S3.send(corsCommand)
                    // Check response.
                    if (corsResponse.$metadata.httpStatusCode === 200)
                        printLog(
                            `The AWS S3 bucket ${bucketName} has been set with the CORS configuration.`,
                            LogLevel.LOG
                        )
                    return {
                        bucketName
                    }
                } catch (error: any) {
                    /** * {@link https://docs.aws.amazon.com/simspaceweaver/latest/userguide/troubeshooting_too-many-buckets.html | TooManyBuckets} */
                    if (error.$metadata.httpStatusCode === 400 && error.Code === `TooManyBuckets`)
                        logAndThrowError(SPECIFIC_ERRORS.SE_STORAGE_TOO_MANY_BUCKETS)

                    // @todo handle more errors here.
                    const commonError = COMMON_ERRORS.CM_INVALID_REQUEST
                    const additionalDetails = error.toString()
                    logAndThrowError(makeError(commonError.code, commonError.message, additionalDetails))
                }
            } else {
                // If there was a different error, re-throw it.
                const commonError = COMMON_ERRORS.CM_INVALID_REQUEST
                const additionalDetails = error.toString()

                logAndThrowError(makeError(commonError.code, commonError.message, additionalDetails))
            }
        }
    }

    async create(ceremonyDto: CeremonyDto) {
        const { circuits, ...ceremonyData } = ceremonyDto

        const ceremony = await this.ceremonyModel.create(ceremonyData as any)

        const circuitEntities = await this.createCircuits(circuits, ceremony)
        await ceremony.$set("circuits", circuitEntities)

        printLog(`Setup completed for ceremony ${ceremony.id}`, LogLevel.DEBUG)
        return ceremony
    }

    async createCircuits(circuits: CircuitDto[], ceremony: CeremonyEntity) {
        const bucketName = getBucketName(ceremony.prefix, String(process.env.AWS_CEREMONY_BUCKET_POSTFIX))
        const ceremonyId = ceremony.id

        const circuitEntities = []
        for (let i = 0, ni = circuits.length; i < ni; i++) {
            let circuit = circuits[i]
            if (circuit.verification.cfOrVm === CircuitContributionVerificationMechanism.VM) {
                const { instance, vmDiskSize } = await this.setupAWSEnvironment(circuit, bucketName)
                // Update the circuit document info accordingly.
                circuit = {
                    ...circuit,
                    verification: {
                        cfOrVm: circuit.verification.cfOrVm,
                        vm: {
                            vmConfigurationType: circuit.verification.vm.vmConfigurationType,
                            vmInstanceId: instance.instanceId,
                            vmDiskSize
                        }
                    }
                }
            }
            const circuitEntity = await this.circuitModel.create({ ...circuit, ceremonyId })
            circuitEntities.push(circuitEntity)
        }
        return circuitEntities
    }

    async setupAWSEnvironment(circuit: CircuitDto, bucketName: string) {
        // VM command to be run at the startup.
        const startupCommand = vmBootstrapCommand(`${bucketName}/circuits/${circuit.name!}`)

        // Get EC2 client.
        const ec2Client = await createEC2Client()

        // Get AWS variables.
        const { snsTopic, region } = getAWSVariables()

        // Prepare dependencies and cache artifacts command.
        const vmCommands = vmDependenciesAndCacheArtifactsCommand(
            `${bucketName}/${circuit.files.initialZkeyStoragePath}`,
            `${bucketName}/${circuit.files.potStoragePath}`,
            snsTopic,
            region
        )

        printLog(`Check VM dependencies and cache artifacts commands ${vmCommands.join("\n")}`, LogLevel.DEBUG)
        // Upload the post-startup commands script file.
        printLog(`Uploading VM post-startup commands script file ${vmBootstrapScriptFilename}`, LogLevel.DEBUG)
        await uploadFileToBucketNoFile(
            bucketName,
            `circuits/${circuit.name!}/${vmBootstrapScriptFilename}`,
            vmCommands.join("\n")
        )
        // TODO: should we create a AWS instance or run it in a docker file?
        // Compute the VM disk space requirement (in GB).
        const vmDiskSize = computeDiskSizeForVM(circuit.zKeySizeInBytes, circuit.metadata.pot)

        printLog(`Check VM startup commands ${startupCommand.join("\n")}`, LogLevel.DEBUG)

        // Configure and instantiate a new VM based on the coordinator input.
        const instance = await createEC2Instance(
            ec2Client,
            startupCommand,
            circuit.verification.vm.vmConfigurationType,
            vmDiskSize,
            circuit.verification.vm.vmDiskType
        )
        return { instance, vmDiskSize }
    }

    findById(id: number) {
        return this.ceremonyModel.findByPk(id, { include: [CircuitEntity] })
    }
}
