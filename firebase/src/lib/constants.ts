/** Firebase */
export const collections = {
  users: "users",
  participants: "participants",
  ceremonies: "ceremonies",
  circuits: "circuits",
  contributions: "contributions",
  transcripts: "transcripts"
}

export const names = {
  output: `output`,
  setup: `setup`,
  contribute: `contribute`,
  pot: `pot`,
  zkeys: `zkeys`,
  metadata: `metadata`,
  transcripts: `transcripts`,
  attestation: `attestation`
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

export const contributionsCollectionFields = {
  contributionTime: "contributionTime",
  files: "files",
  lastUpdated: "lastUpdated",
  participantId: "participantId",
  valid: "valid",
  verificationTime: "verificationTime",
  zkeyIndex: "zKeyIndex"
}
