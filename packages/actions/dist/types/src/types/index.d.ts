export declare type GithubOAuthRequest = {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}
export declare type GithubOAuthResponse = {
  clientSecret: string
  type: string
  tokenType: string
  clientType: string
  clientId: string
  token: string
  scopes: string[]
}
