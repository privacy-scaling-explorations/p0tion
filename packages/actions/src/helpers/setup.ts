import fs from "fs"
/**
 * 
 * {
  "ceremonyName": "Example Ceremony",
  "description": "This is an example ceremony",
  "startDate": "2023-07-01",
  "endDate": "2023-07-31",
  "timeoutThreshold": 3600,
  "fixed": true,
  "threshold": 10,
  "circomVersion": "0.5.1",
  "githubCircomTemplate": "github.com/circom/template",
  "commitHash": "1234567890",
  "paramsArray": ["param1", "param2", "param3"]
}
 */

import { Functions } from "firebase/functions"

// ceremonyInputData: CeremonyInputData,
//     ceremonyPrefix: string,
//     circuits: CircuitDocument[]

/*
export type CeremonyInputData = {
    title: string
    description: string
    startDate: number
    endDate: number
    timeoutMechanismType: CeremonyTimeoutType
    penalty: number
}
export const enum CeremonyTimeoutType {
    DYNAMIC = "DYNAMIC",
    FIXED = "FIXED"
}
export type CircuitDocument = CircuitInputData & {
    metadata?: CircuitMetadata
    files?: CircuitArtifacts
    avgTimings?: CircuitTimings
    template?: SourceTemplateData
    compiler?: CircomCompilerData
    waitingQueue?: CircuitWaitingQueue
    lastUpdated?: number
}
export type CircuitWaitingQueue = {
    completedContributions: number
    contributors: Array<string>
    currentContributor: string
    failedContributions: number
}
export type CircuitTimings = {
    contributionComputation: number
    fullContribution: number
    verifyCloudFunction: number
}
export type CircuitArtifacts = {
    potFilename: string
    r1csFilename: string
    wasmFilename: string
    initialZkeyFilename: string
    potStoragePath: string
    r1csStoragePath: string
    wasmStoragePath: string
    initialZkeyStoragePath: string
    potBlake2bHash: string
    r1csBlake2bHash: string
    wasmBlake2bHash: string
    initialZkeyBlake2bHash: string
}
export type CircuitMetadata = {
    curve: string
    wires: number
    constraints: number
    privateInputs: number
    publicInputs: number
    labels: number
    outputs: number
    pot: number
}
export type CircuitInputData = {
    description: string
    compiler: CircomCompilerData
    template: SourceTemplateData
    verification: CircuitContributionVerification
    compilationArtifacts?: CompilationArtifacts
    metadata?: CircuitMetadata
    name?: string
    dynamicThreshold?: number
    fixedTimeWindow?: number
    sequencePosition?: number
    prefix?: string
    zKeySizeInBytes?: number
}
export type CircuitContributionVerification = {
    cfOrVm: CircuitContributionVerificationMechanism
    vm?: VMConfiguration
}
export type VMConfiguration = {
    vmConfigurationType?: string
    vmDiskType?: DiskTypeForVM
    vmDiskSize?: number
    vmInstanceId?: string
}
export type VMConfigurationType = {
    type: string
    ram: number
    vcpu: number
}
export type CircomCompilerData = {
    version: string
    commitHash: string
}
export type SourceTemplateData = {
    source: string
    commitHash: string
    paramsConfiguration: Array<string>
}
export const enum DiskTypeForVM {
    GP2 = "gp2",
    GP3 = "gp3",
    IO1 = "io1",
    ST1 = "st1",
    SC1 = "sc1"
}
export type CompilationArtifacts = {
    r1csFilename: string
    wasmFilename: string
}
*/

/*
{
  "title": "Example Ceremony",
  "description": "This is an example ceremony",
  "startDate": "2023-07-01",
  "endDate": "2023-07-31",
  "timeoutMechanismType": "FIXED",
  "penalty": 10
  "timeoutThreshold": 3600,
  "fixed": true,
  "threshold": 10,
  "circuits": [
    {
        description: string
        compiler: {
            "version": "1.0",
            "commitHash": "0x1"
        }
        template: {
            "source": "https://github.com",
            "commitHash": "0x1",
            "paramConfiguration": [6,8,3,2]
        }
        verification: {
            "cfOrVM": "VM",
            "vm": {
                "vmConfigurationType" : "1"
                "vmDiskType": "gp2",
                "vmDiskSize": 5,
                "vmInstanceId": "none yet"
            }
        }
        compilationArtifacts?: {
            "r1csFileName": "circuit.r1cs",
            "wasmFileName": "circuit.wasm"
        }
        name: "circuit1"
        dynamicThreshold: 0
        fixedTimeWindow: 3600
        sequencePosition: 1
        prefix: "circuit1"
    }
  ]
}
*/


export const parseCeremonyFile = async (path: string) => {
    const data = JSON.parse(fs.readFileSync(path).toString())

    console.log(data)
}