import {
    CeremonyDocumentAPI,
    CircuitDocumentAPI,
    ParticipantDocumentAPI,
    commonTerms,
    computeSHA256ToHex,
    exportVerifierContract,
    exportVkey,
    finalContributionIndex,
    generateValidContributionsAttestationAPI,
    getCeremonyCircuitsAPI,
    getVerificationKeyStorageFilePath,
    getVerifierContractStorageFilePath,
    multiPartUploadAPI,
    verificationKeyAcronym,
    verifierSmartContractAcronym
} from "@p0tion/actions"
import { checkAndPrepareCoordinatorForFinalizationAPI } from "@p0tion/actions"
import { finalizeCeremonyAPI } from "@p0tion/actions"
import { finalizeCircuitAPI } from "@p0tion/actions"
import { getClosedCeremoniesAPI, getParticipantAPI } from "@p0tion/actions"
import { isCoordinatorAPI } from "@p0tion/actions"
import { dirname } from "path"
import { checkAndRetrieveJWTAuth } from "src/lib-api/auth.js"
import { COMMAND_ERRORS, showError } from "src/lib/errors.js"
import { checkAndMakeNewDirectoryIfNonexistent, writeFile, writeLocalJsonFile } from "src/lib/files.js"
import {
    getFinalAttestationLocalFilePath,
    getFinalZkeyLocalFilePath,
    getVerificationKeyLocalFilePath,
    getVerifierContractLocalFilePath,
    localPaths
} from "src/lib/localConfigs.js"
import { promptForCeremonySelectionAPI, promptToTypeEntropyOrBeacon } from "src/lib/prompts.js"
import theme from "src/lib/theme.js"
import {
    customSpinner,
    generateCustomUrlToTweetAboutParticipation,
    handleStartOrResumeContributionAPI,
    publishGistAPI,
    sleep,
    terminate
} from "src/lib/utils.js"
import { fileURLToPath } from "url"

export const handleVerificationKey = async (
    accessToken: string,
    ceremonyId: number,
    finalZkeyLocalFilePath: string,
    verificationKeyLocalFilePath: string,
    verificationKeyStorageFilePath: string
) => {
    const spinner = customSpinner(`Exporting the verification key...`, "clock")
    spinner.start()

    // Export the verification key.
    const vKey = await exportVkey(finalZkeyLocalFilePath)

    spinner.text = "Writing verification key..."

    // Write the verification key locally.
    writeLocalJsonFile(verificationKeyLocalFilePath, vKey)

    await sleep(3000) // workaround for file descriptor.

    // Upload verification key to storage.
    await multiPartUploadAPI(
        accessToken,
        ceremonyId,
        verificationKeyStorageFilePath,
        verificationKeyLocalFilePath,
        Number(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB)
    )

    spinner.succeed(`Verification key correctly saved on storage`)
}

export const handleVerifierSmartContract = async (
    accessToken: string,
    ceremonyId: number,
    finalZkeyLocalFilePath: string,
    verifierContractLocalFilePath: string,
    verifierContractStorageFilePath: string
) => {
    const spinner = customSpinner(`Extracting verifier contract...`, `clock`)
    spinner.start()

    // Verifier path.
    const packagePath = `${dirname(fileURLToPath(import.meta.url))}`
    const verifierPath = packagePath.includes(`src/commands`)
        ? `${dirname(
              fileURLToPath(import.meta.url)
          )}/../../../../node_modules/snarkjs/templates/verifier_groth16.sol.ejs`
        : `${dirname(fileURLToPath(import.meta.url))}/../node_modules/snarkjs/templates/verifier_groth16.sol.ejs`

    // Export the Solidity verifier smart contract.
    const verifierCode = await exportVerifierContract(finalZkeyLocalFilePath, verifierPath)

    spinner.text = `Writing verifier smart contract...`

    // Write the verification key locally.
    writeFile(verifierContractLocalFilePath, verifierCode)

    await sleep(3000) // workaround for file descriptor.

    // Upload verifier smart contract to storage.
    await multiPartUploadAPI(
        accessToken,
        ceremonyId,
        verifierContractStorageFilePath,
        verifierContractLocalFilePath,
        Number(process.env.CONFIG_STREAM_CHUNK_SIZE_IN_MB)
    )

    spinner.succeed(`Verifier smart contract correctly saved on storage`)
}

export const handleCircuitFinalization = async (
    accessToken: string,
    ceremony: CeremonyDocumentAPI,
    circuit: CircuitDocumentAPI,
    participant: ParticipantDocumentAPI,
    beacon: string,
    coordinatorIdentifier: string,
    circuitsLength: number
) => {
    // Step (1).
    await handleStartOrResumeContributionAPI(
        accessToken,
        ceremony,
        circuit,
        participant,
        computeSHA256ToHex(beacon),
        coordinatorIdentifier,
        true,
        circuitsLength
    )

    await sleep(2000) // workaround for descriptors.

    // Extract data.
    const { prefix: circuitPrefix } = circuit

    // Prepare local paths.
    const finalZkeyLocalFilePath = getFinalZkeyLocalFilePath(`${circuitPrefix}_${finalContributionIndex}.zkey`)
    const verificationKeyLocalFilePath = getVerificationKeyLocalFilePath(
        `${circuitPrefix}_${verificationKeyAcronym}.json`
    )
    const verifierContractLocalFilePath = getVerifierContractLocalFilePath(
        `${circuitPrefix}_${verifierSmartContractAcronym}.sol`
    )

    // Prepare storage paths.
    const verificationKeyStorageFilePath = getVerificationKeyStorageFilePath(
        circuitPrefix,
        `${circuitPrefix}_${verificationKeyAcronym}.json`
    )
    const verifierContractStorageFilePath = getVerifierContractStorageFilePath(
        circuitPrefix,
        `${circuitPrefix}_${verifierSmartContractAcronym}.sol`
    )
    // Step (2 & 4).
    await handleVerificationKey(
        accessToken,
        ceremony.id,
        finalZkeyLocalFilePath,
        verificationKeyLocalFilePath,
        verificationKeyStorageFilePath
    )

    // Step (3 & 4).
    await handleVerifierSmartContract(
        accessToken,
        ceremony.id,
        finalZkeyLocalFilePath,
        verifierContractLocalFilePath,
        verifierContractStorageFilePath
    )

    // Step (5).
    const spinner = customSpinner(`Wrapping up the finalization of the circuit...`, `clock`)
    spinner.start()

    // Finalize circuit contribution.
    await finalizeCircuitAPI(accessToken, ceremony.id, circuit.id, beacon)

    await sleep(2000)

    spinner.succeed(`Circuit has been finalized correctly`)
}

const finalize = async (cmd: { auth?: string }) => {
    const { token, user } = checkAndRetrieveJWTAuth(cmd.auth)

    // Retrieve the closed ceremonies (ready for finalization).
    const ceremoniesClosedForFinalization = await getClosedCeremoniesAPI(token)

    // Gracefully exit if no ceremonies are closed and ready for finalization.
    if (!ceremoniesClosedForFinalization.length) showError(COMMAND_ERRORS.COMMAND_FINALIZED_NO_CLOSED_CEREMONIES, true)

    console.log(
        `${theme.symbols.warning} The computation of the final contribution could take the bulk of your computational resources and memory based on the size of the circuit ${theme.emojis.fire}\n`
    )

    // Prompt for ceremony selection.
    const selectedCeremony = await promptForCeremonySelectionAPI(
        ceremoniesClosedForFinalization,
        true,
        "Which ceremony would you like to finalize?"
    )

    // Preserve command execution only for coordinators.
    if (!(await isCoordinatorAPI(token, selectedCeremony.id))) showError(COMMAND_ERRORS.COMMAND_NOT_COORDINATOR, true)

    let participant = await getParticipantAPI(token, selectedCeremony.id)
    const isCoordinatorReadyForCeremonyFinalization = await checkAndPrepareCoordinatorForFinalizationAPI(
        token,
        selectedCeremony.id
    )

    if (!isCoordinatorReadyForCeremonyFinalization)
        showError(COMMAND_ERRORS.COMMAND_FINALIZED_NOT_READY_FOR_FINALIZATION, true)

    // Prompt for beacon.
    const beacon = await promptToTypeEntropyOrBeacon(false)
    // Compute hash
    const beaconHash = computeSHA256ToHex(beacon)
    // Display.
    console.log(`${theme.symbols.info} Beacon SHA256 hash ${theme.text.bold(beaconHash)}`)

    // Clean directories.
    checkAndMakeNewDirectoryIfNonexistent(localPaths.output)
    checkAndMakeNewDirectoryIfNonexistent(localPaths.finalize)
    checkAndMakeNewDirectoryIfNonexistent(localPaths.finalZkeys)
    checkAndMakeNewDirectoryIfNonexistent(localPaths.finalPot)
    checkAndMakeNewDirectoryIfNonexistent(localPaths.finalAttestations)
    checkAndMakeNewDirectoryIfNonexistent(localPaths.verificationKeys)
    checkAndMakeNewDirectoryIfNonexistent(localPaths.verifierContracts)

    // Get ceremony circuits.
    const circuits = await getCeremonyCircuitsAPI(token, selectedCeremony.id)
    // Handle finalization for each ceremony circuit.
    for await (const circuit of circuits)
        await handleCircuitFinalization(
            token,
            selectedCeremony,
            circuit,
            participant,
            beacon,
            user.displayName,
            circuits.length
        )

    process.stdout.write(`\n`)

    const spinner = customSpinner(`Wrapping up the finalization of the ceremony...`, "clock")
    spinner.start()

    // Finalize the ceremony.
    await finalizeCeremonyAPI(token, selectedCeremony.id)

    spinner.succeed(
        `Great, you have completed the finalization of the ${theme.text.bold(selectedCeremony.title)} ceremony ${
            theme.emojis.tada
        }\n`
    )

    // Get updated coordinator participant document.
    participant = await getParticipantAPI(token, selectedCeremony.id)

    // Extract updated data.
    const { contributions } = participant
    const { prefix, title: ceremonyName } = selectedCeremony

    // Generate attestation with final contributions.
    const publicAttestation = await generateValidContributionsAttestationAPI(
        token,
        circuits,
        selectedCeremony.id,
        participant.id,
        contributions,
        user.displayName,
        ceremonyName,
        true
    )

    // Write public attestation locally.
    writeFile(
        getFinalAttestationLocalFilePath(
            `${prefix}_${finalContributionIndex}_${commonTerms.foldersAndPathsTerms.attestation}.log`
        ),
        Buffer.from(publicAttestation)
    )

    await sleep(3000) // workaround for file descriptor unexpected close.

    const gistUrl = await publishGistAPI(publicAttestation, ceremonyName, prefix)

    console.log(
        `\n${
            theme.symbols.info
        } Your public final attestation has been successfully posted as Github Gist (${theme.text.bold(
            theme.text.underlined(gistUrl)
        )})`
    )

    // Generate a ready to share custom url to tweet about ceremony participation.
    const tweetUrl = generateCustomUrlToTweetAboutParticipation(ceremonyName, gistUrl, true)

    console.log(
        `${
            theme.symbols.info
        } We encourage you to tweet about the ceremony finalization by clicking the link below\n\n${theme.text.underlined(
            tweetUrl
        )}`
    )

    // Automatically open a webpage with the tweet.
    open(tweetUrl)

    terminate(user.displayName)
}

export default finalize
