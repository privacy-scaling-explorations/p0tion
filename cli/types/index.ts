// Custom type for Github generated OAuth codes.
export type GithubOAuthCodes = {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}
