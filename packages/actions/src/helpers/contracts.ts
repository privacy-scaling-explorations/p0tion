import { Contract, ContractFactory, Signer } from "ethers"
import { Firestore, where } from "firebase/firestore"
import { Functions } from "firebase/functions"
import fs from "fs"
import solc from "solc"
import {
    downloadAllCeremonyArtifacts,
    exportVerifierAndVKey,
    generateGROTH16Proof,
    generateZkeyFromScratch,
    getFinalContributionBeacon,
    verifyGROTH16Proof,
    verifyZKey
} from "./verification"
import { compareHashes } from "./crypto"
import { commonTerms, finalContributionIndex, verificationKeyAcronym, verifierSmartContractAcronym } from "./constants"
import { fromQueryToFirebaseDocumentInfo, queryCollection } from "./database"
import { unstringifyBigInts } from "./utils"

/**
 * Formats part of a GROTH16 SNARK proof
 * @link adapted from SNARKJS p256 function
 * @param proofPart <any> a part of a proof to be formatted
 * @returns <string> the formatted proof part
 */
export const p256 = (proofPart: any) => {
    let nProofPart = proofPart.toString(16)
    while (nProofPart.length < 64) nProofPart = `0${nProofPart}`
    nProofPart = `0x${nProofPart}`
    return nProofPart
}

/**
 * This function formats the calldata for Solidity
 * @link adapted from SNARKJS formatSolidityCalldata function
 * @dev this function is supposed to be called with
 * @dev the output of generateGROTH16Proof
 * @param circuitInput <string[]> Inputs to the circuit
 * @param _proof <object> Proof
 * @returns <SolidityCalldata> The calldata formatted for Solidity
 */
export const formatSolidityCalldata = (circuitInput: string[], _proof: any): any => {
    try {
        const proof = unstringifyBigInts(_proof) as any
        // format the public inputs to the circuit
        const formattedCircuitInput = []
        for (const cInput of circuitInput) {
            formattedCircuitInput.push(p256(unstringifyBigInts(cInput)))
        }
        // construct calldata
        const calldata = {
            arg1: [p256(proof.pi_a[0]), p256(proof.pi_a[1])],
            arg2: [
                [p256(proof.pi_b[0][1]), p256(proof.pi_b[0][0])],
                [p256(proof.pi_b[1][1]), p256(proof.pi_b[1][0])]
            ],
            arg3: [p256(proof.pi_c[0]), p256(proof.pi_c[1])],
            arg4: formattedCircuitInput
        }
        return calldata
    } catch (error: any) {
        throw new Error(
            "There was an error while formatting the calldata. Please make sure that you are calling this function with the output of the generateGROTH16Proof function, and then please try again."
        )
    }
}

/**
 * Verify a GROTH16 SNARK proof on chain
 * @param contract <Contract> The contract instance
 * @param proof <SolidityCalldata> The calldata formatted for Solidity
 * @returns <Promise<boolean>> Whether the proof is valid or not
 */
export const verifyGROTH16ProofOnChain = async (contract: any, proof: any): Promise<boolean> => {
    const res = await contract.verifyProof(proof.arg1, proof.arg2, proof.arg3, proof.arg4)
    return res
}

/**
 * Compiles a contract given a path
 * @param contractPath <string> path to the verifier contract
 * @returns <Promise<any>> the compiled contract
 */
export const compileContract = async (contractPath: string): Promise<any> => {
    if (!fs.existsSync(contractPath))
        throw new Error(
            "The contract path does not exist. Please make sure that you are passing a valid path to the contract and try again."
        )

    const data = fs.readFileSync(contractPath).toString()
    const input = {
        language: "Solidity",
        sources: {
            Verifier: { content: data }
        },
        settings: {
            outputSelection: {
                "*": {
                    "*": ["*"]
                }
            }
        }
    }

    try {
        const compiled = JSON.parse(solc.compile(JSON.stringify(input), { import: { contents: "" } }))
        return compiled.contracts.Verifier.Verifier
    } catch (error: any) {
        throw new Error(
            "There was an error while compiling the smart contract. Please check that the file is not corrupted and try again."
        )
    }
}

/**
 * Deploy the verifier contract
 * @param contractFactory <ContractFactory> The contract factory
 * @returns <Promise<Contract>> The contract instance
 */
export const deployVerifierContract = async (contractPath: string, signer: Signer): Promise<Contract> => {
    const compiledContract = await compileContract(contractPath)
    // connect to hardhat node running locally
    const contractFactory = new ContractFactory(compiledContract.abi, compiledContract.evm.bytecode.object, signer)
    const contract = await contractFactory.deploy()
    await contract.deployed()
    return contract
}

/**
 * Verify a ceremony validity
 * 1. Download all artifacts
 * 2. Verify that the zkeys are valid
 * 3. Extract the verifier and the vKey
 * 4. Generate a proof and verify it locally
 * 5. Deploy Verifier contract and verify the proof on-chain
 * @param functions <Functions> firebase functions instance
 * @param firestore <Firestore> firebase firestore instance
 * @param ceremonyPrefix <string> ceremony prefix
 * @param outputDirectory <string> output directory where to store the ceremony artifacts
 * @param circuitInputsPath <string> path to the circuit inputs file
 * @param verifierTemplatePath <string> path to the verifier template file
 * @param signer <Signer> signer for contract interaction
 * @param logger <any> logger for printing snarkjs output
 */
export const verifyCeremony = async (
    functions: Functions,
    firestore: Firestore,
    ceremonyPrefix: string,
    outputDirectory: string,
    circuitInputsPath: string,
    verifierTemplatePath: string,
    signer: Signer,
    logger?: any
): Promise<void> => {
    // 1. download all ceremony artifacts
    const ceremonyArtifacts = await downloadAllCeremonyArtifacts(functions, firestore, ceremonyPrefix, outputDirectory)
    // if there are no ceremony artifacts, we throw an error
    if (ceremonyArtifacts.length === 0)
        throw new Error(
            "There was an error while downloading all ceremony artifacts. Please review your ceremony prefix and try again."
        )

    // extract the circuit inputs
    if (!fs.existsSync(circuitInputsPath))
        throw new Error("The circuit inputs file does not exist. Please check the path and try again.")
    const circuitsInputs = JSON.parse(fs.readFileSync(circuitInputsPath).toString())

    // find the ceremony given the prefix
    const ceremonyQuery = await queryCollection(firestore, commonTerms.collections.ceremonies.name, [
        where(commonTerms.collections.ceremonies.fields.prefix, "==", ceremonyPrefix)
    ])

    // get the ceremony data - no need to do an existence check as
    // we already checked that the ceremony exists in downloafAllCeremonyArtifacts
    const ceremonyData = fromQueryToFirebaseDocumentInfo(ceremonyQuery.docs)
    const ceremony = ceremonyData.at(0)
    // this is required to re-generate the final zKey
    const { coordinatorId } = ceremony!.data
    const ceremonyId = ceremony!.id

    // we verify each circuit separately
    for (const ceremonyArtifact of ceremonyArtifacts) {
        // get the index of the circuit in the list of circuits
        const inputIndex = ceremonyArtifacts.indexOf(ceremonyArtifact)

        // 2. verify the final zKey
        const isValid = await verifyZKey(
            ceremonyArtifact.r1csLocalFilePath,
            ceremonyArtifact.finalZkeyLocalFilePath,
            ceremonyArtifact.potLocalFilePath,
            logger
        )

        if (!isValid)
            throw new Error(
                `The zkey for Circuit ${ceremonyArtifact.circuitPrefix} is not valid. Please check that the artifact is correct. If not, you might have to re run the final contribution to compute a valid final zKey.`
            )

        // 3. get the final contribution beacon
        const contributionBeacon = await getFinalContributionBeacon(
            firestore,
            ceremonyId,
            ceremonyArtifact.circuitId,
            coordinatorId
        )
        const generatedFinalZkeyPath = `${ceremonyArtifact.directoryRoot}/${ceremonyArtifact.circuitPrefix}_${finalContributionIndex}_verification.zkey`
        // 4. re generate the zkey using the beacon and check hashes
        await generateZkeyFromScratch(
            true,
            ceremonyArtifact.r1csLocalFilePath,
            ceremonyArtifact.potLocalFilePath,
            generatedFinalZkeyPath,
            logger,
            ceremonyArtifact.lastZkeyLocalFilePath,
            coordinatorId,
            contributionBeacon
        )
        const zKeysMatching = await compareHashes(generatedFinalZkeyPath, ceremonyArtifact.finalZkeyLocalFilePath)
        if (!zKeysMatching)
            throw new Error(
                `The final zkey for the Circuit ${ceremonyArtifact.circuitPrefix} does not match the one generated from the beacon. Please confirm manually by downloading from the S3 bucket.`
            )

        // 5. extract the verifier and the vKey
        const verifierLocalPath = `${ceremonyArtifact.directoryRoot}/${ceremonyArtifact.circuitPrefix}_${verifierSmartContractAcronym}_verification.sol`
        const vKeyLocalPath = `${ceremonyArtifact.directoryRoot}/${ceremonyArtifact.circuitPrefix}_${verificationKeyAcronym}_verification.json`
        await exportVerifierAndVKey(
            ceremonyArtifact.finalZkeyLocalFilePath,
            verifierLocalPath,
            vKeyLocalPath,
            verifierTemplatePath
        )

        // 6. verify that the generated verifier and vkey match the ones downloaded from S3
        const verifierMatching = await compareHashes(verifierLocalPath, ceremonyArtifact.verifierLocalFilePath)
        if (!verifierMatching)
            throw new Error(
                `The verifier contract for the Contract ${ceremonyArtifact.circuitPrefix} does not match the one downloaded from S3. Please confirm manually by downloading from the S3 bucket.`
            )
        const vKeyMatching = await compareHashes(vKeyLocalPath, ceremonyArtifact.verificationKeyLocalFilePath)
        if (!vKeyMatching)
            throw new Error(
                `The verification key for the Contract ${ceremonyArtifact.circuitPrefix} does not match the one downloaded from S3. Please confirm manually by downloading from the S3 bucket.`
            )

        // 7. generate a proof and verify it locally (use either of the downloaded or generated as the hashes will have matched at this point)
        const { proof, publicSignals } = await generateGROTH16Proof(
            circuitsInputs[inputIndex],
            ceremonyArtifact.finalZkeyLocalFilePath,
            ceremonyArtifact.wasmLocalFilePath,
            logger
        )
        const isProofValid = await verifyGROTH16Proof(vKeyLocalPath, publicSignals, proof)
        if (!isProofValid)
            throw new Error(
                `Could not verify the proof for Circuit ${ceremonyArtifact.circuitPrefix}. Please check that the artifacts are correct as well as the inputs to the circuit, and try again.`
            )

        // 8. deploy Verifier contract and verify the proof on-chain
        const verifierContract = await deployVerifierContract(verifierLocalPath, signer)
        const formattedProof = await formatSolidityCalldata(publicSignals, proof)
        const isProofValidOnChain = await verifyGROTH16ProofOnChain(verifierContract, formattedProof)
        if (!isProofValidOnChain)
            throw new Error(
                `Could not verify the proof on-chain for Circuit ${ceremonyArtifact.circuitPrefix}. Please check that the artifacts are correct as well as the inputs to the circuit, and try again.`
            )
    }
}
