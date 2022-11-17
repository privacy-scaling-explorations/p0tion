/**
 * Gestisce l'autenticazione OAuth 2.0 con device workflow usando Firebase e Github.
 */
declare const getNewOAuthTokenUsingGithubDeviceFlow: (ghClientId: string) => Promise<string>
export default getNewOAuthTokenUsingGithubDeviceFlow
