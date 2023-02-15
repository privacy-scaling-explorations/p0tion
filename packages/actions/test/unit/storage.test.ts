import chai, { assert, expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth"
import fs from "fs"
import { randomBytes } from "crypto"
import {
    deleteAdminApp,
    initializeAdminServices,
    initializeUserServices,
    deleteBucket,
    cleanUpMockCeremony,
    createMockCeremony,
    deleteObjectFromS3,
    envType,
    generateUserPasswords,
    createMockUser,
    getStorageConfiguration,
    cleanUpMockUsers
} from "../utils"
import { fakeCeremoniesData, fakeCircuitsData, fakeUsersData } from "../data/samples"
import {
    getBucketName,
    createS3Bucket,
    objectExist,
    multiPartUpload,
    getR1csStorageFilePath,
    getPotStorageFilePath,
    getZkeyStorageFilePath,
    getVerificationKeyStorageFilePath,
    getVerifierContractStorageFilePath,
    getTranscriptStorageFilePath,
    potFilenameTemplate,
    commonTerms,
    genesisZkeyIndex
} from "../../src"
import { TestingEnvironment } from "../../src/types/enums"
import { ChunkWithUrl, ETagWithPartNumber } from "../../src/types/index"
import {
    closeMultiPartUpload,
    generateGetObjectPreSignedUrl,
    getChunksAndPreSignedUrls,
    openMultiPartUpload,
    uploadParts
} from "../../src/helpers/storage"

chai.use(chaiAsPromised)

describe("Storage", () => {
    // the user without coordinator privileges
    const users = [fakeUsersData.fakeUser1, fakeUsersData.fakeUser2]
    const passwords = generateUserPasswords(2)

    const { adminFirestore, adminAuth } = initializeAdminServices()
    const { userApp, userFunctions } = initializeUserServices()
    const userAuth = getAuth(userApp)

    const { ceremonyBucketPostfix, streamChunkSizeInMb, presignedUrlExpirationInSeconds } = getStorageConfiguration()

    const localPath = "/tmp/test.json"
    fs.writeFileSync(localPath, "{test: 'test'}")

    // test setup for all nested tests
    beforeAll(async () => {
        // create two users with the second as coordinator
        for (let i = 0; i < 2; i++) {
            // we want to update the uid so we can delete later
            users[i].uid = await createMockUser(
                userApp,
                users[i].data.email,
                passwords[i],
                i === passwords.length - 1,
                adminAuth
            )
        }
    })

    describe("getBucketName", () => {
        it("should return the correct bucket name", () => {
            expect(getBucketName("Test", "-mpc-dev")).to.be.equal("Test-mpc-dev")
            expect(getBucketName("Test", "")).to.be.equal("Test")
        })
    })

    // These tests can only run on the production environment due to the large number of buckets being created
    // which will require S3 keys to delete thus an .env file
    if (envType === TestingEnvironment.PRODUCTION) {
        describe("createS3Bucket", () => {
            const bucketName = randomBytes(10).toString("hex")
            const repeatedName = randomBytes(10).toString("hex")
            it("should fail to create a bucket when not logged in", async () => {
                await signOut(userAuth)
                expect(createS3Bucket(userFunctions, bucketName)).to.be.rejectedWith(
                    "You do not have privileges to perform this operation."
                )
            })
            it("should create a bucket when logged in as coordinator", async () => {
                // login with coordinator creds
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                // create bucket
                assert.isFulfilled(createS3Bucket(userFunctions, bucketName))
            })
            it("should fail to create a bucket with a name that exists already", async () => {
                await createS3Bucket(userFunctions, repeatedName)
                expect(createS3Bucket(userFunctions, repeatedName)).to.be.rejectedWith("Failed request.")
            })
            it("should fail to create a bucket when not logged in as a coordinator", async () => {
                // login as contributor
                await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
                expect(createS3Bucket(userFunctions, bucketName)).to.be.rejectedWith(
                    "You do not have privileges to perform this operation."
                )
            })
            // clean up
            afterAll(async () => {
                await deleteBucket(bucketName)
                await deleteBucket(repeatedName)
            })
        })

        describe("objectExist", () => {
            const bucketName = randomBytes(10).toString("hex")
            const objectName = randomBytes(10).toString("hex")
            // file to upload
            beforeAll(async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                // create bucket
                await createS3Bucket(userFunctions, bucketName)
                // upload object
                const success = await multiPartUpload(
                    userFunctions,
                    bucketName,
                    objectName,
                    localPath,
                    streamChunkSizeInMb.toString(),
                    presignedUrlExpirationInSeconds
                )
                expect(success).to.be.true
            })
            it("should return true if the object exists", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                // check existence
                const exists = await objectExist(userFunctions, bucketName, objectName)
                expect(exists).to.be.equal(true)
            })
            it("should return false when given a non existant bucket name", async () => {
                // check existence
                const exists = await objectExist(userFunctions, "nonExistingBucket", objectName)
                expect(exists).to.be.equal(false)
            })
            it("should return false if the object does not exist", async () => {
                // execute function
                const exists = await objectExist(userFunctions, bucketName, "nonExistingObject")
                expect(exists).to.be.equal(false)
            })
            it("should not work if given an invalid userFunctions parameter", async () => {
                const test: any = {}
                assert.isRejected(objectExist(test, bucketName, objectName))
            })
            it("should throw if a user without coordinator privileges tries to call objectExist", async () => {
                // login as contributor
                await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
                // execute function
                assert.isRejected(objectExist(userFunctions, bucketName, objectName))
            })
            it("should throw when calling objectExist without being authenticated", async () => {
                // logout
                await signOut(userAuth)
                // execute function
                assert.isRejected(objectExist(userFunctions, bucketName, objectName))
            })
            // cleanup after test
            afterAll(async () => {
                // delete object inside first
                await deleteObjectFromS3(bucketName, objectName)
                await deleteBucket(bucketName)
            })
        })

        describe("multiPartUpload", () => {
            const bucketName = randomBytes(10).toString("hex")
            const objectName = randomBytes(10).toString("hex")
            beforeAll(async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                // create bucket
                await createS3Bucket(userFunctions, bucketName)
                await createMockCeremony(
                    adminFirestore,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed,
                    fakeCircuitsData.fakeCircuitSmallNoContributors
                )
                await signOut(userAuth)
            })
            it("should fail when providing a non-existent bucket name", async () => {
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                expect(
                    multiPartUpload(
                        userFunctions,
                        "nonExistentBucketName",
                        objectName,
                        localPath,
                        streamChunkSizeInMb.toString(),
                        presignedUrlExpirationInSeconds
                    )
                ).to.be.rejectedWith("Failed request.")
            })
            it("should allow the coordinator to upload a file to S3", async () => {
                const success = await multiPartUpload(
                    userFunctions,
                    bucketName,
                    objectName,
                    localPath,
                    streamChunkSizeInMb.toString(),
                    presignedUrlExpirationInSeconds
                )
                expect(success).to.be.true
            })
            it("should overwrite an existing object with the same name", async () => {
                const success = await multiPartUpload(
                    userFunctions,
                    bucketName,
                    objectName,
                    localPath,
                    streamChunkSizeInMb.toString(),
                    presignedUrlExpirationInSeconds
                )
                expect(success).to.be.true
            })
            it("should fail when called by a user without coordinator privileges and no ceremony Id parameter", async () => {
                await signOut(userAuth)
                // login as contributor
                await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
                // call the function
                expect(
                    multiPartUpload(
                        userFunctions,
                        bucketName,
                        objectName,
                        localPath,
                        streamChunkSizeInMb.toString(),
                        presignedUrlExpirationInSeconds
                    )
                ).to.be.rejectedWith("Unable to perform the operation due to incomplete or incorrect data.")
            })
            it("should fail when called without being logged in", async () => {
                await signOut(userAuth)
                expect(
                    multiPartUpload(
                        userFunctions,
                        bucketName,
                        objectName,
                        localPath,
                        streamChunkSizeInMb.toString(),
                        presignedUrlExpirationInSeconds
                    )
                ).to.be.rejectedWith("You are not authorized to perform this operation.")
            })
            // cleanup after test
            afterAll(async () => {
                await deleteObjectFromS3(bucketName, objectName)
                await deleteBucket(bucketName)
                await cleanUpMockCeremony(
                    adminFirestore,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    fakeCircuitsData.fakeCircuitSmallNoContributors.uid
                )
            })
        })

        describe("generateGetObjectPreSignedUrl", () => {
            const bucketName = randomBytes(10).toString("hex")
            const objectName = randomBytes(10).toString("hex")
            beforeAll(async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                // create bucket
                await createS3Bucket(userFunctions, bucketName)
                // upload object
                const success = await multiPartUpload(
                    userFunctions,
                    bucketName,
                    objectName,
                    localPath,
                    streamChunkSizeInMb.toString(),
                    presignedUrlExpirationInSeconds
                )
                expect(success).to.be.true

                // create a ceremony
                await createMockCeremony(
                    adminFirestore,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed,
                    fakeCircuitsData.fakeCircuitSmallNoContributors
                )
            })
            it("should throw when given an invalid FirestoreFunctions object", async () => {
                assert.isRejected(generateGetObjectPreSignedUrl({} as any, bucketName, objectName))
            })
            it("should generate the pre signed URL for an existing object", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                const url = await generateGetObjectPreSignedUrl(
                    userFunctions,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.data.prefix,
                    "anObject"
                )
                /* eslint-disable no-useless-escape */
                const regex =
                    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/
                expect(url).to.match(regex)
            })
            it("should fail to generate the pre signed URL for a non existing object", async () => {
                expect(
                    generateGetObjectPreSignedUrl(userFunctions, bucketName, "nonExistingObject")
                ).to.be.rejectedWith("Unable to generate a pre-signed url for the given object in the provided bucket.")
            })
            it("should not be possible to call this function when not authenticated", async () => {
                await signOut(userAuth)
                expect(generateGetObjectPreSignedUrl(userFunctions, bucketName, objectName)).to.be.rejectedWith(
                    "You are not authorized to perform this operation."
                )
            })
            // clean up after test
            afterAll(async () => {
                await deleteObjectFromS3(bucketName, objectName)
                await deleteBucket(bucketName)
                await cleanUpMockCeremony(
                    adminFirestore,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    fakeCircuitsData.fakeCircuitSmallNoContributors.uid
                )
            })
        })

        describe("openMultiPartUpload", () => {
            const bucketName = randomBytes(10).toString("hex")
            beforeAll(async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                // create the bucket
                await createS3Bucket(userFunctions, bucketName)
                // logout
                await signOut(userAuth)
                // add mock ceremony data
                await createMockCeremony(
                    adminFirestore,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed,
                    fakeCircuitsData.fakeCircuitSmallNoContributors
                )
            })
            it("should successfully open a multi part upload when provided the correct parameters", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                const id = await openMultiPartUpload(userFunctions, bucketName, "objectKey")
                expect(id).to.not.be.null
            })
            it("should fail to open a multi part upload when provided the wrong parameters", async () => {
                assert.isRejected(openMultiPartUpload({} as any, bucketName, "objectKey"))
            })
            it("should fail to open a multi part upload when provided a non existent bucket", async () => {
                assert.isRejected(openMultiPartUpload(userFunctions, "nonExistentBucket", "objectKey"))
            })
            it("should not allow a contributor to open a multi part upload when not providing a ceremony Id parameter", async () => {
                assert.isRejected(openMultiPartUpload(userFunctions, bucketName, "objectKey"))
            })
            it("should fail when calling without being authenticated", async () => {
                // logout
                await signOut(userAuth)
                assert.isRejected(openMultiPartUpload(userFunctions, bucketName, "objectKey"))
            })
            it("should allow a contributor to open a multi part upload when providing a ceremony Id parameter", async () => {})

            afterAll(async () => {
                await deleteBucket(bucketName)
                await cleanUpMockCeremony(
                    adminFirestore,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    fakeCircuitsData.fakeCircuitSmallNoContributors.uid
                )
            })
        })

        describe("getChunksAndPreSignedUrls", () => {
            const bucketName = getBucketName(
                fakeCeremoniesData.fakeCeremonyOpenedFixed.data.prefix!,
                ceremonyBucketPostfix
            )
            let multiPartUploadId: string
            const objectKey = "circuitMetadata.json"
            beforeAll(async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                // create the bucket
                await createS3Bucket(userFunctions, bucketName)
                // Create the mock data on Firestore.
                await createMockCeremony(
                    adminFirestore,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed,
                    fakeCircuitsData.fakeCircuitSmallNoContributors
                )
                // create multi part upload
                multiPartUploadId = await openMultiPartUpload(userFunctions, bucketName, objectKey)
                expect(multiPartUploadId).to.not.be.null
            })
            it("should fail when calling without being authenticated", async () => {
                // make sure we are logged out
                await signOut(userAuth)
                expect(
                    getChunksAndPreSignedUrls(
                        userFunctions,
                        bucketName,
                        objectKey,
                        localPath,
                        multiPartUploadId,
                        presignedUrlExpirationInSeconds,
                        streamChunkSizeInMb.toString()
                    )
                ).to.be.rejectedWith("You are not authorized to perform this operation")
            })
            it("should successfully get the preSignedUrls when provided the correct parameters (connected as a coordinator)", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                const chunksWithUrlsZkey = await getChunksAndPreSignedUrls(
                    userFunctions,
                    bucketName,
                    objectKey,
                    localPath,
                    multiPartUploadId,
                    presignedUrlExpirationInSeconds,
                    streamChunkSizeInMb.toString()
                )
                expect(chunksWithUrlsZkey[0].preSignedUrl).to.not.be.null
                await signOut(userAuth)
            })
            it("should fail to get the preSignedUrls when provided an incorrect multi part upload ID", async () => {
                // @todo add validation on backend to check if the multiPartUploadId is valid or that a bucket exists
                // before calling the cloud function that interacts with S3
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                assert.isRejected(
                    getChunksAndPreSignedUrls(
                        userFunctions,
                        "nonExistentBucket",
                        "nonExistentObjectKey",
                        localPath,
                        "nonExistentMultiPartUploadId",
                        presignedUrlExpirationInSeconds,
                        streamChunkSizeInMb.toString()
                    )
                )
                await signOut(userAuth)
            })
            // @todo contribution tests
            it.skip("should allow any authenticated user to call getChunksAndPreSignedUrls when providing an existing ceremony Id", async () => {
                // sign in as contributor
                await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
                // need to mock the ceremony
                // should work
                const chunksWithUrlsZkey = await getChunksAndPreSignedUrls(
                    userFunctions,
                    bucketName,
                    objectKey,
                    localPath,
                    multiPartUploadId,
                    presignedUrlExpirationInSeconds,
                    streamChunkSizeInMb.toString(),
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid
                )
                expect(chunksWithUrlsZkey[0].preSignedUrl).to.not.be.null
            })
            it("should fail when called by a contributor and provided the wrong details", async () => {
                // sign in as contributor
                await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
                // need to mock the ceremony
                // should work
                expect(
                    getChunksAndPreSignedUrls(
                        userFunctions,
                        bucketName,
                        objectKey,
                        localPath,
                        multiPartUploadId,
                        presignedUrlExpirationInSeconds,
                        streamChunkSizeInMb.toString(),
                        fakeCeremoniesData.fakeCeremonyOpenedFixed.uid
                    )
                ).to.be.rejectedWith(
                    "Unable to find a document with the given identifier for the provided collection path."
                )
            })
            it("should fail when called by a contributor that is not in the UPLOADING phase", async () => {
                // @todo add when dealing with contribute as it will have all required mock functions
            })

            afterAll(async () => {
                await deleteObjectFromS3(bucketName, objectKey)
                await deleteBucket(bucketName)
                await cleanUpMockCeremony(
                    adminFirestore,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    fakeCircuitsData.fakeCircuitSmallNoContributors.uid
                )
            })
        })

        describe("uploadParts", () => {
            const bucketName = getBucketName(
                fakeCeremoniesData.fakeCeremonyOpenedFixed.data.prefix!,
                process.env.CONFIG_CEREMONY_BUCKET_POSTFIX!
            )
            let multiPartUploadId: string
            const objectKey = "circuitMetadata.json"
            let chunksWithUrls: ChunkWithUrl[]
            beforeAll(async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                // create the bucket
                await createS3Bucket(userFunctions, bucketName)
                // create the mock data on Firestore.
                await createMockCeremony(
                    adminFirestore,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed,
                    fakeCircuitsData.fakeCircuitSmallNoContributors
                )
                // open the multi part upload
                multiPartUploadId = await openMultiPartUpload(userFunctions, bucketName, objectKey)
                expect(multiPartUploadId).to.not.be.null
                // get the preSignedUrls
                chunksWithUrls = await getChunksAndPreSignedUrls(
                    userFunctions,
                    bucketName,
                    objectKey,
                    localPath,
                    multiPartUploadId,
                    presignedUrlExpirationInSeconds,
                    streamChunkSizeInMb.toString()
                )
                // logout
                await signOut(userAuth)
            })
            it("should successfully upload the file part when provided the correct parameters", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                const uploadPartResult = await uploadParts(chunksWithUrls, "application/json")
                expect(uploadPartResult).to.not.be.null
                await signOut(userAuth)
            })
            it(
                "should return null data when calling with parameters related to a " +
                    "contribution and the wrong pre-signed URLs",
                async () => {
                    // @todo we need to mock the ceremony participant in the collection
                    // @todo to be included when writing tests for contribute
                    // login as coordinator
                    await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                    expect(
                        uploadParts(
                            [
                                {
                                    partNumber: 1,
                                    preSignedUrl:
                                        "https://nonExistentBucket.s3.amazonaws.com/nonExistentObjectKey?partNumber=1&uploadId=nonExistentMultiPartUploadId",
                                    chunk: Buffer.from("test", "utf-8")
                                }
                            ],
                            "application/json"
                        )
                    ).to.be.rejectedWith(
                        "Unable to upload chunk number 0. Please, terminate the process in order to resume from the latest uploaded chunk."
                    )
                    await signOut(userAuth)
                }
            )
            it("should allow any authenticated user to call uploadParts with the correct chunks", async () => {
                // sign in as contributor
                await signInWithEmailAndPassword(userAuth, users[0].data.email, passwords[0])
                // upload
                const uploadPartResult = await uploadParts(chunksWithUrls, "application/json")
                expect(uploadPartResult).to.not.be.null
                await signOut(userAuth)
            })
            afterAll(async () => {
                await deleteObjectFromS3(bucketName, objectKey)
                await deleteBucket(bucketName)
                await cleanUpMockCeremony(
                    adminFirestore,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    fakeCircuitsData.fakeCircuitSmallNoContributors.uid
                )
            })
        })

        describe("closeMultiPartUpload", () => {
            const bucketName = getBucketName(
                fakeCeremoniesData.fakeCeremonyOpenedFixed.data.prefix!,
                process.env.CONFIG_CEREMONY_BUCKET_POSTFIX!
            )
            let multiPartUploadId: string
            const objectKey = "circuitMetadata.json"
            let chunksWithUrls: ChunkWithUrl[]
            let uploadPartsResult: ETagWithPartNumber[]
            beforeAll(async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                // create the bucket
                await createS3Bucket(userFunctions, bucketName)
                // create the mock data on Firestore.
                await createMockCeremony(
                    adminFirestore,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed,
                    fakeCircuitsData.fakeCircuitSmallNoContributors
                )
                // open the multi part upload
                multiPartUploadId = await openMultiPartUpload(userFunctions, bucketName, objectKey)
                expect(multiPartUploadId).to.not.be.null
                // get the preSignedUrls
                chunksWithUrls = await getChunksAndPreSignedUrls(
                    userFunctions,
                    bucketName,
                    objectKey,
                    localPath,
                    multiPartUploadId,
                    presignedUrlExpirationInSeconds,
                    streamChunkSizeInMb.toString()
                )
                uploadPartsResult = await uploadParts(chunksWithUrls, "application/json")
            })
            it("should successfully close the multi part upload when provided the correct parameters", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, users[1].data.email, passwords[1])
                const closeMultiPartUploadResult = await closeMultiPartUpload(
                    userFunctions,
                    bucketName,
                    objectKey,
                    multiPartUploadId,
                    uploadPartsResult
                )
                expect(closeMultiPartUploadResult).to.not.be.null
            })
            it("should fail to close the multi part upload when provided the wrong parameters", async () => {
                expect(
                    closeMultiPartUpload(
                        userFunctions,
                        bucketName,
                        objectKey,
                        "nonExistentMultiPartUploadId",
                        uploadPartsResult
                    )
                ).to.be.rejectedWith("Failed request.")
            })
            it("should fail when calling without being authenticated", async () => {
                await signOut(userAuth)
                expect(
                    closeMultiPartUpload(userFunctions, bucketName, objectKey, multiPartUploadId, uploadPartsResult)
                ).to.be.rejectedWith("You are not authorized to perform this operation.")
            })
            afterAll(async () => {
                await deleteObjectFromS3(bucketName, objectKey)
                await deleteBucket(bucketName)
                await cleanUpMockCeremony(
                    adminFirestore,
                    fakeCeremoniesData.fakeCeremonyOpenedFixed.uid,
                    fakeCircuitsData.fakeCircuitSmallNoContributors.uid
                )
            })
        })
    }

    describe("getR1csStorageFilePath", () => {
        const r1csName = "circuit.r1cs"
        it("should return the correct path for a r1cs file", () => {
            const result = getR1csStorageFilePath(
                fakeCircuitsData.fakeCircuitSmallNoContributors.data.prefix!,
                r1csName
            )
            expect(result).to.equal(
                `${commonTerms.collections.circuits.name}/${fakeCircuitsData.fakeCircuitSmallNoContributors.data
                    .prefix!}/${r1csName}`
            )
        })
    })

    describe("getPotStorageFilePath", () => {
        const potFile = `${potFilenameTemplate}8.ptau`
        it("should return the correct path for a pot file", () => {
            const result = getPotStorageFilePath(potFile)
            expect(result).to.equal(`${commonTerms.foldersAndPathsTerms.pot}/${potFile}`)
        })
    })

    describe("getZkeyStorageFilePath", () => {
        const zkeyFile = `${fakeCircuitsData.fakeCircuitSmallContributors.data.prefix!}_${genesisZkeyIndex}.zkey`
        it("should return the correct path for a zkey file", () => {
            const result = getZkeyStorageFilePath(fakeCircuitsData.fakeCircuitSmallContributors.data.prefix!, zkeyFile)
            expect(result).to.equal(
                `${commonTerms.collections.circuits.name}/${fakeCircuitsData.fakeCircuitSmallContributors.data
                    .prefix!}/${commonTerms.collections.contributions.name}/${zkeyFile}`
            )
        })
    })

    describe("getVerificationKeyStorageFilePath", () => {
        const verificationKeyFile = `${fakeCircuitsData.fakeCircuitSmallContributors.data.prefix!}_vkey.json`
        it("should return the correct path for a verification key file", () => {
            const result = getVerificationKeyStorageFilePath(
                fakeCircuitsData.fakeCircuitSmallContributors.data.prefix!,
                verificationKeyFile
            )
            expect(result).to.equal(
                `${commonTerms.collections.circuits.name}/${fakeCircuitsData.fakeCircuitSmallContributors.data
                    .prefix!}/${verificationKeyFile}`
            )
        })
    })

    describe("getVerifierContractStorageFilePath", () => {
        const verifierContractFile = `${fakeCircuitsData.fakeCircuitSmallContributors.data.prefix!}_verifier.sol`
        it("should return the correct path for a verifier contract file", () => {
            const result = getVerifierContractStorageFilePath(
                fakeCircuitsData.fakeCircuitSmallContributors.data.prefix!,
                verifierContractFile
            )
            expect(result).to.equal(
                `${commonTerms.collections.circuits.name}/${fakeCircuitsData.fakeCircuitSmallContributors.data
                    .prefix!}/${verifierContractFile}`
            )
        })
    })

    describe("getTranscriptStorageFilePath", () => {
        const transcriptFile = `tester_verification_transcript.log`
        it("should return the correct path for a transcript file", () => {
            const result = getTranscriptStorageFilePath(
                fakeCircuitsData.fakeCircuitSmallContributors.data.prefix!,
                transcriptFile
            )
            expect(result).to.equal(
                `${commonTerms.collections.circuits.name}/${fakeCircuitsData.fakeCircuitSmallContributors.data
                    .prefix!}/${commonTerms.foldersAndPathsTerms.transcripts}/${transcriptFile}`
            )
        })
    })

    // @todo this is not used in the cli yet
    describe("uploadFileToStorage", () => {
        it("should successfully upload a file to storage", async () => {})
        it("should not overwrite a file stored from another user", async () => {})
        it("should fail to upload a file to storage if the user is not logged in", async () => {})
        it("should fail to upload a file to storage if given a wrong local path", async () => {})
    })

    // general cleanup
    afterAll(async () => {
        // Clean user from DB.
        await cleanUpMockUsers(adminAuth, adminFirestore, users)
        // Delete app.
        await deleteAdminApp()
        // Remove test file.
        fs.unlinkSync(localPath)
    })
})
