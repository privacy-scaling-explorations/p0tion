import { blake512FromPath, convertToDoubleDigits, parseCeremonyFile, checkIfObjectExistAPI } from "@p0tion/actions"
import { existsSync } from "fs"
import { zKey } from "snarkjs"
import { checkAndRetrieveJWTAuth } from "../../lib-api/auth.js"
import { handleCircuitArtifactUploadToStorage } from "../../lib-api/storage.js"
import { checkAndMakeNewDirectoryIfNonexistent, cleanDir, getFileStats } from "../../lib/files.js"
import { getPotLocalFilePath, getZkeyLocalFilePath, localPaths } from "../../lib/localConfigs.js"
import theme from "../../lib/theme.js"
import { customSpinner, sleep, terminate } from "../../lib/utils.js"
import { createBucket, createCeremony, createCircuits } from "../../lib-api/ceremony.js"
import { checkAndDownloadSmallestPowersOfTau } from "../setup.js"

const create = async (cmd: { template?: string; auth?: string }) => {
    const { token, user } = checkAndRetrieveJWTAuth(cmd.auth)

    console.log(token)

    // Get current working directory.
    const cwd = process.cwd()

    console.log(
        `${theme.symbols.warning} To setup a zkSNARK Groth16 Phase 2 Trusted Setup ceremony you need to have the Rank-1 Constraint System (R1CS) file for each circuit in your working directory`
    )
    console.log(
        `\n${theme.symbols.info} Your current working directory is ${theme.text.bold(
            theme.text.underlined(process.cwd())
        )}\n`
    )

    // Prepare local directories.
    checkAndMakeNewDirectoryIfNonexistent(localPaths.output)
    cleanDir(localPaths.setup)
    cleanDir(localPaths.pot)
    cleanDir(localPaths.zkeys)
    cleanDir(localPaths.wasm)
    // if there is the file option, then set up the non interactively
    if (cmd.template) {
        // 1. parse the file
        // tmp data - do not cleanup files as we need them
        const spinner = customSpinner(`Parsing ${theme.text.bold(cmd.template!)} setup configuration file...`, `clock`)
        spinner.start()
        const setupCeremonyData = await parseCeremonyFile(cmd.template!)
        spinner.succeed(`Parsing of ${theme.text.bold(cmd.template!)} setup configuration file completed successfully`)

        // final setup data
        const ceremonySetupData = setupCeremonyData
        // create ceremony
        const { id: ceremonyId } = await createCeremony(ceremonySetupData, token)
        // create bucket
        const { bucketName } = await createBucket(ceremonyId, token)
        console.log(`\n${theme.symbols.success} Ceremony bucket name: ${theme.text.bold(bucketName)}`)
        // loop through each circuit
        for await (const circuit of setupCeremonyData.circuits) {
            // Local paths.
            const index = ceremonySetupData.circuits.indexOf(circuit)
            const r1csLocalPathAndFileName = `./${circuit.name}.r1cs`
            const wasmLocalPathAndFileName = `./${circuit.name}.wasm`
            const potLocalPathAndFileName = getPotLocalFilePath(circuit.files.potFilename)
            const zkeyLocalPathAndFileName = getZkeyLocalFilePath(circuit.files.initialZkeyFilename)

            // 2. download the pot and wasm files
            await checkAndDownloadSmallestPowersOfTau(
                convertToDoubleDigits(circuit.metadata?.pot!),
                circuit.files.potFilename
            )
            // 3. generate the zKey
            const zKeySpinner = customSpinner(
                `Generating genesis zKey for circuit ${theme.text.bold(circuit.name)}...`,
                `clock`
            )
            zKeySpinner.start()

            if (existsSync(zkeyLocalPathAndFileName)) {
                zKeySpinner.succeed(
                    `The genesis zKey for circuit ${theme.text.bold(circuit.name)} is already present on disk`
                )
            } else {
                await zKey.newZKey(
                    r1csLocalPathAndFileName,
                    getPotLocalFilePath(circuit.files.potFilename),
                    zkeyLocalPathAndFileName,
                    undefined
                )
                zKeySpinner.succeed(
                    `Generation of the genesis zKey for circuit ${theme.text.bold(circuit.name)} completed successfully`
                )
            }
            const hashSpinner = customSpinner(
                `Calculating hashes for circuit ${theme.text.bold(circuit.name)}...`,
                `clock`
            )
            hashSpinner.start()
            // 4. calculate the hashes
            const wasmBlake2bHash = await blake512FromPath(wasmLocalPathAndFileName)
            const potBlake2bHash = await blake512FromPath(getPotLocalFilePath(circuit.files.potFilename))
            const initialZkeyBlake2bHash = await blake512FromPath(zkeyLocalPathAndFileName)

            hashSpinner.succeed(`Hashes for circuit ${theme.text.bold(circuit.name)} calculated successfully`)
            // 5. upload the artifacts

            // Upload zKey to Storage.
            await handleCircuitArtifactUploadToStorage(
                circuit.files.initialZkeyStoragePath,
                ceremonyId,
                zkeyLocalPathAndFileName,
                circuit.files.initialZkeyFilename,
                token,
                true
            )

            const { result: alreadyUploadedPot } = await checkIfObjectExistAPI(
                token,
                ceremonyId,
                circuit.files.potStoragePath
            )

            // If it wasn't uploaded yet, upload it.
            if (!alreadyUploadedPot) {
                // Upload PoT to Storage.
                await handleCircuitArtifactUploadToStorage(
                    circuit.files.potStoragePath,
                    ceremonyId,
                    potLocalPathAndFileName,
                    circuit.files.potFilename,
                    token,
                    true
                )
            }

            // Upload r1cs to Storage.
            await handleCircuitArtifactUploadToStorage(
                circuit.files.r1csStoragePath,
                ceremonyId,
                r1csLocalPathAndFileName,
                circuit.files.r1csFilename,
                token,
                true
            )

            // Upload wasm to Storage.
            await handleCircuitArtifactUploadToStorage(
                circuit.files.wasmStoragePath,
                ceremonyId,
                r1csLocalPathAndFileName,
                circuit.files.wasmFilename,
                token,
                true
            )

            // 6 update the setup data object
            ceremonySetupData.circuits[index].files = {
                ...circuit.files,
                potBlake2bHash,
                wasmBlake2bHash,
                initialZkeyBlake2bHash
            }

            ceremonySetupData.circuits[index].zKeySizeInBytes = getFileStats(zkeyLocalPathAndFileName).size
        }

        // create circuits in ceremony
        await createCircuits(ceremonyId, token, ceremonySetupData.circuits)

        console.log(
            `Congratulations, the setup of ceremony ${theme.text.bold(
                ceremonySetupData.ceremonyInputData.title
            )} (${`UID: ${theme.text.bold(ceremonyId)}`}) has been successfully completed ${
                theme.emojis.tada
            }. You will be able to find all the files and info respectively in the ceremony bucket and database document.`
        )

        terminate(user.displayName)
    } else {
        // TODO: complete this
    }
}

export default create
