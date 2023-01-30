export const terms = {
    output: `output`,
    setup: `setup`,
    contribute: `contribute`,
    finalize: `finalize`,
    pot: `pot`,
    zkeys: `zkeys`,
    vkeys: `vkeys`,
    metadata: `metadata`,
    transcripts: `transcripts`,
    attestation: `attestation`,
    verifiers: `verifiers`
}

export const potDownloadUrlTemplate = `https://hermez.s3-eu-west-1.amazonaws.com/`
export const potFilenameTemplate = `powersOfTau28_hez_final_`

/** Firebase */
export const collections = {
    users: "users",
    participants: "participants",
    ceremonies: "ceremonies",
    circuits: "circuits",
    contributions: "contributions",
    timeouts: "timeouts"
}

export const contributionsCollectionFields = {
    contributionTime: "contributionTime",
    files: "files",
    lastUpdated: "lastUpdated",
    participantId: "participantId",
    valid: "valid",
    verificationTime: "verificationTime",
    zkeyIndex: "zKeyIndex"
}

export const firstZkeyIndex = `00000`

export const timeoutsCollectionFields = {
    startDate: "startDate",
    endDate: "endDate"
}

export const ceremoniesCollectionFields = {
    coordinatorId: "coordinatorId",
    description: "description",
    endDate: "endDate",
    lastUpdated: "lastUpdated",
    prefix: "prefix",
    startDate: "startDate",
    state: "state",
    title: "title",
    type: "type"
}
