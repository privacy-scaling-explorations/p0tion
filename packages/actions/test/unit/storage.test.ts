import chai, { assert, expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth"
import fs from "fs"
import { randomBytes } from "crypto"
import {
    addCoordinatorPrivileges,
    createNewFirebaseUserWithEmailAndPw,
    deleteAdminApp,
    generatePseudoRandomStringOfNumbers,
    initializeAdminServices,
    initializeUserServices,
    sleep,
    deleteBucket,
    cleanUpMockCeremony,
    createMockCeremony,
    deleteObjectFromS3,
    envType
} from "../utils"
import { fakeCircuitsData, fakeUsersData } from "../data/samples"
import {
    getBucketName,
    createS3Bucket,
    objectExist,
    getCurrentFirebaseAuthUser,
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
    const user = fakeUsersData.fakeUser1
    const coordinatorEmail = "coordinator@coordinator.com"
    // storing the uid so we can delete the user after the test
    let coordinatorUid: string

    const { adminFirestore, adminAuth } = initializeAdminServices()

    const { userApp, userFunctions } = initializeUserServices()
    const userAuth = getAuth(userApp)
    const userPassword = generatePseudoRandomStringOfNumbers(24)
    const coordinatorPwd = generatePseudoRandomStringOfNumbers(24)

    const ceremonyPostfix = "-mpc-dev"

    const localPath = "/tmp/test.txt"
    fs.writeFileSync(localPath, "test content")

    // test setup for all nested tests
    beforeAll(async () => {
        // create a new user without contributor privileges
        await createNewFirebaseUserWithEmailAndPw(userApp, user.data.email, userPassword)
        await sleep(5000)

        // Retrieve the current auth user in Firebase.
        const currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
        user.uid = currentAuthenticatedUser.uid

        // create account for coordinator
        await createNewFirebaseUserWithEmailAndPw(userApp, coordinatorEmail, coordinatorPwd)
        await sleep(5000)
        // store the uid
        const currentAuthenticatedCoordinator = getCurrentFirebaseAuthUser(userApp)
        coordinatorUid = currentAuthenticatedCoordinator.uid
        await addCoordinatorPrivileges(adminAuth, coordinatorUid)
    })

    describe("getBucketName", () => {
        it("should return the correct bucket name", () => {
            expect(getBucketName("Test", ceremonyPostfix)).to.be.equal("Test-mpc-dev")
            expect(getBucketName("Test", "")).to.be.equal("Test")
        })
    })

    // These tests can only run on the production environment
    if (envType === TestingEnvironment.PRODUCTION) {
        describe("createS3Bucket", () => {
            const bucketName = randomBytes(10).toString("hex")
            const repeatedName = randomBytes(10).toString("hex")
            it("should fail to create a bucket when not logged in", async () => {
                await signOut(userAuth)
                assert.isRejected(createS3Bucket(userFunctions, bucketName))
            })
            it("should create a bucket when logged in as coordinator", async () => {
                // login with coordinator creds
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                // create bucket
                const success = await createS3Bucket(userFunctions, bucketName)
                expect(success).to.be.equal(true)
            })
            it("should fail to create a bucket with a name that exists already", async () => {
                // login with coordinator creds
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                await createS3Bucket(userFunctions, repeatedName)
                assert.isRejected(createS3Bucket(userFunctions, repeatedName))
            })
            it("should fail to create a bucket when not logged in as a coordinator", async () => {
                await signOut(userAuth)
                // login as contributor
                await signInWithEmailAndPassword(userAuth, user.data.email, userPassword)
                assert.isRejected(createS3Bucket(userFunctions, bucketName))
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
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                // create bucket
                await createS3Bucket(userFunctions, bucketName)
                // upload object
                const success = await multiPartUpload(
                    userFunctions,
                    bucketName,
                    objectName,
                    localPath,
                    process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128",
                    Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS) || 3600
                )
                expect(success).to.be.true
            })
            it("should return false if the object does not exist", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                // execute function
                const exists = await objectExist(userFunctions, bucketName, "nonExistingObject")
                expect(exists).to.be.equal(false)
            })
            it("should throw if a user without coordinator privileges tries to call objectExist", async () => {
                // login as contributor
                await signInWithEmailAndPassword(userAuth, user.data.email, userPassword)
                // execute function
                assert.isRejected(objectExist(userFunctions, bucketName, objectName))
            })
            it("should throw when calling objectExist without being authenticated", async () => {
                // logout
                await signOut(userAuth)
                // execute function
                assert.isRejected(objectExist(userFunctions, bucketName, objectName))
            })
            it("should return true if the object exists", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                // check existence
                const exists = await objectExist(userFunctions, bucketName, objectName)
                expect(exists).to.be.equal(true)
            })
            it("should return false when given a non existant bucket name", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                // check existence
                const exists = await objectExist(userFunctions, "nonExistingBucket", objectName)
                expect(exists).to.be.equal(false)
            })
            it("should not work if given an invalid userFunctions parameter", async () => {
                const test: any = {}
                assert.isRejected(objectExist(test, bucketName, objectName))
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
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                // create bucket
                await createS3Bucket(userFunctions, bucketName)
                // logout to reset state
                await signOut(userAuth)
            })

            it("should fail when called by a user without coordinator privileges", async () => {
                // login as contributor
                await signInWithEmailAndPassword(userAuth, user.data.email, userPassword)
                // call the function
                assert.isRejected(
                    multiPartUpload(
                        userFunctions,
                        bucketName,
                        objectName,
                        localPath,
                        process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128",
                        Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS) || 3600
                    )
                )
            })
            it("should fail when called without being logged in", async () => {
                await signOut(userAuth)
                assert.isRejected(
                    multiPartUpload(
                        userFunctions,
                        bucketName,
                        objectName,
                        localPath,
                        process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128",
                        Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS) || 3600
                    )
                )
            })
            it("should fail when providing a non-existent bucket name", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                assert.isRejected(
                    multiPartUpload(
                        userFunctions,
                        "nonExistentBucketName",
                        objectName,
                        localPath,
                        process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128",
                        Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS) || 3600
                    )
                )
            })
            it("should allow the coordinator to upload a file to S3", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                const success = await multiPartUpload(
                    userFunctions,
                    bucketName,
                    objectName,
                    localPath,
                    process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128",
                    Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS) || 3600
                )
                expect(success).to.be.true
            })
            it("should overwrite an existing object with the same name", async () => {
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                const success = await multiPartUpload(
                    userFunctions,
                    bucketName,
                    objectName,
                    localPath,
                    process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128",
                    Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS) || 3600
                )
                expect(success).to.be.true
            })
            // cleanup after test
            afterAll(async () => {
                await deleteObjectFromS3(bucketName, objectName)
                await deleteBucket(bucketName)
            })
        })

        describe("generateGetObjectPreSignedUrl", () => {
            const bucketName = randomBytes(10).toString("hex")
            const objectName = randomBytes(10).toString("hex")
            beforeAll(async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                // create bucket
                await createS3Bucket(userFunctions, bucketName)
                // upload object
                const success = await multiPartUpload(
                    userFunctions,
                    bucketName,
                    objectName,
                    localPath,
                    process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128",
                    Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS) || 3600
                )
                expect(success).to.be.true
            })
            it.skip("should throw when given an invalid FirestoreFunctions object", async () => {
                assert.isRejected(generateGetObjectPreSignedUrl({} as any, bucketName, objectName))
            })
            it.skip("should generate the pre signed URL for an existing object", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                const url = await generateGetObjectPreSignedUrl(userFunctions, bucketName, objectName)
                expect(url).to.be.a("string")
            })
            it.skip("should fail to generate the pre signed URL for a non existing object", async () => {
                // @todo check if it is a desiderable behaviour to fail when the object does not exist
                // or just return an invalid URL
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                expect(generateGetObjectPreSignedUrl(userFunctions, bucketName, "nonExistingObject")).to.be.rejected
            })
            it.skip("should not be possible to call this function when not authenticated", async () => {
                // @todo enforce auth check in the cloud function
                await signOut(userAuth)
                console.log(await generateGetObjectPreSignedUrl(userFunctions, bucketName, objectName))
                expect(generateGetObjectPreSignedUrl(userFunctions, bucketName, objectName)).to.be.rejected
            })
            // clean up after test
            afterAll(async () => {
                await deleteObjectFromS3(bucketName, objectName)
                await deleteBucket(bucketName)
            })
        })

        describe("openMultiPartUpload", () => {
            const bucketName = randomBytes(10).toString("hex")
            beforeAll(async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                // create the bucket
                await createS3Bucket(userFunctions, bucketName)
                // logout
                await signOut(userAuth)
                // add mock ceremony data
                await createMockCeremony(adminFirestore)
            })
            it("should successfully open a multi part upload when provided the correct parameters", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)

                const id = await openMultiPartUpload(userFunctions, bucketName, "objectKey")
                expect(id).to.not.be.null
            })
            it("should fail to open a multi part upload when provided the wrong parameters", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)

                assert.isRejected(openMultiPartUpload({} as any, bucketName, "objectKey"))
            })
            it("should fail to open a multi part upload when provided a non existent bucket", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)

                assert.isRejected(openMultiPartUpload(userFunctions, "nonExistentBucket", "objectKey"))
            })
            it("should not allow a contributor to open a multi part upload when not providing a ceremony Id parameter", async () => {
                // login as contributor
                await signInWithEmailAndPassword(userAuth, user.data.email, userPassword)

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
                await cleanUpMockCeremony(adminFirestore)
            })
        })

        describe("getChunksAndPreSignedUrls", () => {
            const bucketName = randomBytes(10).toString("hex")
            let multiPartUploadId: string
            const objectKey = "circuitMetadata.json"
            beforeAll(async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                // create the bucket
                await createS3Bucket(userFunctions, bucketName)
                // Create the mock data on Firestore.
                await createMockCeremony(adminFirestore)
                // create multi part upload
                multiPartUploadId = await openMultiPartUpload(userFunctions, bucketName, "objectKey")
                expect(multiPartUploadId).to.not.be.null
                // logout
                await signOut(userAuth)
            })
            it("should successfully get the preSignedUrls when provided the correct parameters (connected as a coordinator)", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                const chunksWithUrlsZkey = await getChunksAndPreSignedUrls(
                    userFunctions,
                    bucketName,
                    objectKey,
                    localPath,
                    multiPartUploadId,
                    Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS || 7200),
                    process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128"
                )
                expect(chunksWithUrlsZkey[0].preSignedUrl).to.not.be.null
                await signOut(userAuth)
            })
            it.skip("should fail to get the preSignedUrls when provided an incorrect multi part upload ID", async () => {
                // @todo add validation on backend to check if the multiPartUploadId is valid or that a bucket exists
                // before calling the cloud function that interacts with S3
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                assert.isRejected(
                    getChunksAndPreSignedUrls(
                        userFunctions,
                        "nonExistentBucket",
                        "nonExistentObjectKey",
                        localPath,
                        "nonExistentMultiPartUploadId",
                        Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS || 7200),
                        process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128"
                    )
                )
                await signOut(userAuth)
            })
            it.skip("should allow any authenticated user to call getChunksAndPreSignedUrls when providing a ceremony Id", async () => {
                // sign in as contributor
                await signInWithEmailAndPassword(userAuth, user.data.email, userPassword)
                // need to mock the ceremony
                // should work
                const chunksWithUrlsZkey = await getChunksAndPreSignedUrls(
                    userFunctions,
                    bucketName,
                    objectKey,
                    localPath,
                    multiPartUploadId,
                    Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS || 7200),
                    process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128"
                )
                expect(chunksWithUrlsZkey[0].preSignedUrl).to.not.be.null
            })
            it("should fail when calling without being authenticated", async () => {
                // make sure we are logged out
                await signOut(userAuth)
                assert.isRejected(
                    getChunksAndPreSignedUrls(
                        userFunctions,
                        bucketName,
                        objectKey,
                        localPath,
                        multiPartUploadId,
                        Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS || 7200),
                        process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128"
                    )
                )
            })
            afterAll(async () => {
                await deleteBucket(bucketName)
                await cleanUpMockCeremony(adminFirestore)
            })
        })

        describe("uploadParts", () => {
            const bucketName = randomBytes(10).toString("hex")
            let multiPartUploadId: string
            const objectKey = "circuitMetadata.json"
            let chunksWithUrls: ChunkWithUrl[]
            beforeAll(async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                // create the bucket
                await createS3Bucket(userFunctions, bucketName)
                // create the mock data on Firestore.
                await createMockCeremony(adminFirestore)
                // open the multi part upload
                multiPartUploadId = await openMultiPartUpload(userFunctions, bucketName, "objectKey")
                expect(multiPartUploadId).to.not.be.null
                // get the preSignedUrls
                chunksWithUrls = await getChunksAndPreSignedUrls(
                    userFunctions,
                    bucketName,
                    objectKey,
                    localPath,
                    multiPartUploadId,
                    Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS || 7200),
                    process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128"
                )
                // logout
                await signOut(userAuth)
            })
            it("should successfully upload the file part when provided the correct parameters", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                const uploadPartResult = await uploadParts(chunksWithUrls, "application/json")
                expect(uploadPartResult).to.not.be.null
                await signOut(userAuth)
            })
            it.skip(
                "should return null data when calling with parameters related to a " +
                    "contribution and the wrong pre-signed URLs",
                async () => {
                    // @todo we need to mock the ceremony participant in the collection
                    // @todo to be included when writing tests for contribute
                    // login as coordinator
                    await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                    const uploadPartsRes = await uploadParts(
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
                    expect(uploadPartsRes[0].ETag).to.be.null
                    await signOut(userAuth)
                }
            )
            it("should allow any authenticated user to call uploadParts", async () => {
                // sign in as contributor
                await signInWithEmailAndPassword(userAuth, user.data.email, userPassword)
                // upload
                const uploadPartResult = await uploadParts(chunksWithUrls, "application/json")
                expect(uploadPartResult).to.not.be.null
                await signOut(userAuth)
            })
            afterAll(async () => {
                await deleteBucket(bucketName)
                await cleanUpMockCeremony(adminFirestore)
            })
        })

        describe("closeMultiPartUpload", () => {
            const bucketName = randomBytes(10).toString("hex")
            let multiPartUploadId: string
            const objectKey = "circuitMetadata.json"
            let chunksWithUrls: ChunkWithUrl[]
            let uploadPartsResult: ETagWithPartNumber[]
            beforeAll(async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                // create the bucket
                await createS3Bucket(userFunctions, bucketName)
                // create the mock data on Firestore.
                await createMockCeremony(adminFirestore)
                // open the multi part upload
                multiPartUploadId = await openMultiPartUpload(userFunctions, bucketName, "objectKey")
                expect(multiPartUploadId).to.not.be.null
                // get the preSignedUrls
                chunksWithUrls = await getChunksAndPreSignedUrls(
                    userFunctions,
                    bucketName,
                    objectKey,
                    localPath,
                    multiPartUploadId,
                    Number(process.env.CONFIG_PRESIGNED_URL_EXPIRATION_IN_SECONDS || 7200),
                    process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB || "128"
                )
                // upload the parts
                uploadPartsResult = await uploadParts(chunksWithUrls, "application/json")

                // logout
                await signOut(userAuth)
            })
            // @todo fix this test
            it.skip("should successfully close the multi part upload when provided the correct parameters", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                const closeMultiPartUploadResult = await closeMultiPartUpload(
                    userFunctions,
                    bucketName,
                    objectKey,
                    multiPartUploadId,
                    uploadPartsResult
                )
                expect(closeMultiPartUploadResult).to.not.be.null
                await signOut(userAuth)
            })
            it("should fail to close the multi part upload when provided the wrong parameters", async () => {
                // login as coordinator
                await signInWithEmailAndPassword(userAuth, coordinatorEmail, coordinatorPwd)
                assert.isRejected(
                    closeMultiPartUpload(
                        userFunctions,
                        bucketName,
                        objectKey,
                        "nonExistentMultiPartUploadId",
                        uploadPartsResult
                    )
                )
            })
            it("should fail when calling without being authenticated", async () => {
                await signOut(userAuth)
                assert.isRejected(
                    closeMultiPartUpload(userFunctions, bucketName, objectKey, multiPartUploadId, uploadPartsResult)
                )
            })
            afterAll(async () => {
                await deleteBucket(bucketName)
                await cleanUpMockCeremony(adminFirestore)
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
        // Clean ceremony and user from DB.
        await adminFirestore.collection("users").doc(user.uid).delete()
        await adminAuth.deleteUser(coordinatorUid)

        // Remove Auth user.
        await adminAuth.deleteUser(user.uid)
        await adminFirestore.collection("users").doc(coordinatorUid).delete()

        // Delete app.
        await deleteAdminApp()

        // Remove test file.
        fs.unlinkSync(localPath)
    })
})
