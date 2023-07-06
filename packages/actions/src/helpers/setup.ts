import fs from "fs"
import { CeremonyTimeoutType } from "../types/enums"
import { 
    CircuitDocument, 
    CircuitInputData, 
    convertToDoubleDigits, 
    genesisZkeyIndex, 
    getPotStorageFilePath, 
    getR1CSInfo, 
    getR1csStorageFilePath, 
    getWasmStorageFilePath, 
    getZkeyStorageFilePath, 
    potFilenameTemplate
} from "../index"
import { SetupCeremonyData } from "../types"

/**
 * Parse and validate that the ceremony configuration is correct
 * @notice this does not upload any files to storage
 * @param path <string> - the path to the configuration file
 * @returns SetupCeremonyData - the data to pass to the cloud function for setup
 */
export const parseCeremonyFile = (path: string): SetupCeremonyData => {
    // check that the path exists
    if (!fs.existsSync(path)) throw new Error("Error while setting up the ceremony. The provided path to the configuration file does not exist. Please provide an absolute path and try again.")
    
    // read the data
    const data = JSON.parse(fs.readFileSync(path).toString())

    // verify that the data is correct
    if (data['timeoutMechanismType'] !== CeremonyTimeoutType.DYNAMIC && data['timeoutMechanismType'] !== CeremonyTimeoutType.FIXED) 
        throw new Error("Invalid timeout type. Please choose between")
    
    // validate that we have at least 1 circuit input data
    if (!data['circuits']) 
        throw new Error("Error while setting up the ceremony. You need to provide the data for at least 1 circuit.")

    // validate that the end date is in the future
    let endDate: Date 
    let startDate: Date 
    try {
        endDate = new Date(data['endDate'])
        startDate = new Date(data['startDate'])
    } catch (error: any) {
        throw new Error("Error while setting up the ceremony. The dates should follow this format: 2023-07-04T00:00:00.")
    }

    if (endDate <= startDate) throw new Error("Error while setting up the ceremony. The end date should be greater than the start date.")
   
    const currentDate = new Date()

    if (endDate <= currentDate || startDate <= currentDate) 
        throw new Error("Error while setting up the ceremony. The start and end dates should be in the future.")
    
    // validate penalty
    if (data['penalty'] <= 0) throw new Error("Error while setting up the ceremony. The penalty should be greater than zero.")

    const circuits: CircuitDocument[] = []
    const urlPattern = /(https?:\/\/[^\s]+)/g
    const commitHashPattern = /^[a-f0-9]{40}$/i

    for (let i = 0; i < data['circuits'].length; i++) {
        const circuitData = data['circuits'][i]
        const artifacts = circuitData['artifacts']
        const r1csPath = artifacts['r1csLocalFilePath']
        const wasmPath = artifacts['wasmLocalFilePath']

        // ensure that the artifact exist locally
        if (!fs.existsSync(r1csPath)) throw new Error("Error while setting up the ceremony. The path to the r1cs file does not exist. Please ensure this is correct and that an absolute path is provided.")
        if (!fs.existsSync(wasmPath)) throw new Error("Error while setting up the ceremony. The path to the wasm file does not exist. Please ensure this is correct and that an absolute path is provided.")

        // extract the metadata from the r1cs
        const metadata = getR1CSInfo(r1csPath)

        // validate that the circuit hash and template links are valid
        const template = circuitData['template']

        const URLMatch = template['source'].match(urlPattern)
        if (URLMatch.length === 0 || URLMatch.length > 1) throw new Error("Error while setting up the ceremony. You should provide the URL to the circuits templates on GitHub.")

        const hashMatch = template['commitHash'].match(commitHashPattern)
        if (hashMatch.length === 0 || hashMatch.length > 1) throw new Error("Error while setting up the ceremony. You should provide a valid commit hash of the circuit templates.")
        
        const circuitPrefix = circuitData['prefix']

        // filenames
        const doubleDigitsPowers = convertToDoubleDigits(metadata.pot!)
        const r1csCompleteFilename = `${circuitData['name']}.r1cs`
        const wasmCompleteFilename = `${circuitData['name']}.wasm`
        const smallestPowersOfTauCompleteFilenameForCircuit = `${potFilenameTemplate}${doubleDigitsPowers}.ptau`
        const firstZkeyCompleteFilename = `${circuitData['prefix']}_${genesisZkeyIndex}.zkey`

        // storage paths 
        const r1csStorageFilePath = getR1csStorageFilePath(circuitPrefix, r1csCompleteFilename)
        const wasmStorageFilePath = getWasmStorageFilePath(circuitPrefix, wasmCompleteFilename)
        const potStorageFilePath = getPotStorageFilePath(smallestPowersOfTauCompleteFilenameForCircuit)
        const zkeyStorageFilePath = getZkeyStorageFilePath(circuitPrefix, firstZkeyCompleteFilename)
  
        const files: any = {
            potFilename: smallestPowersOfTauCompleteFilenameForCircuit,
            r1csFilename: r1csCompleteFilename,
            wasmFilename: wasmCompleteFilename,
            initialZkeyFilename: firstZkeyCompleteFilename,
            potStoragePath: potStorageFilePath,
            r1csStoragePath: r1csStorageFilePath,
            wasmStoragePath: wasmStorageFilePath,
            initialZkeyStoragePath: zkeyStorageFilePath
        }

        // validate that the compiler hash is a valid hash 
        const compiler = circuitData['compiler']
        const compilerHashMatch = compiler['commitHash'].match(commitHashPattern)
        if (compilerHashMatch.length === 0 || compilerHashMatch.length > 1) throw new Error("Error while setting up the ceremony. You should provide a valid commit hash of the circuit compiler.")

        // validate that the verification options are valid
        const verification = circuitData['verification']
        if (verification['cfOrVM'] !== "CF" && verification['cfOrVM'] !== "VM") 
            throw new Error("Error while setting up the ceremony. Please enter a valid verification mechanism: either CF or VM")

        // @todo VM parameters verification
        // if (verification['cfOrVM'] === "VM") {}

        // check that the timeout is provided for the correct configuration
        let dynamicThreshold: number | undefined
        let fixedTimeWindow: number | undefined
        if (data['timeoutMechanismType'] === CeremonyTimeoutType.DYNAMIC) {
            if (circuitData['dynamicTreshold'] <= 0) 
                throw new Error("Error while setting up the ceremony. The dynamic threshold should be > 0.")
            dynamicThreshold = circuitData['dynamicTreshold']
        }

        if (data['timeoutMechanismType'] === CeremonyTimeoutType.FIXED) {
            if (circuitData['fixedTimeWindow'] <= 0) 
                throw new Error("Error while setting up the ceremony. The fixed time window threshold should be > 0.")
            fixedTimeWindow = circuitData['fixedTimeWindow']
        }

        // the Circuit data for the ceremony setup
        const circuit: CircuitDocument | CircuitInputData = {
            name: circuitData['name'],
            description: circuitData['description'],
            prefix: circuitData['prefix'],
            sequencePosition: i+1,
            metadata: metadata,
            files: files,
            template: template,
            compiler: compiler,
            verification: verification,
            fixedTimeWindow: fixedTimeWindow,
            dynamicThreshold: dynamicThreshold,
            avgTimings: {
                contributionComputation: 0,
                fullContribution: 0,
                verifyCloudFunction: 0
            },
            
        }

        circuits.push(circuit)
    }

    const setupData: SetupCeremonyData = {
        ceremonyInputData: {
            title: data['title'],
            description: data['description'],
            startDate: startDate.valueOf(),
            endDate: endDate.valueOf(),
            timeoutMechanismType: data['timeoutMechanismType'],
            penalty: data['penalty']
        },
        ceremonyPrefix: data['prefix'],
        circuits: circuits
    }

    return setupData 
}