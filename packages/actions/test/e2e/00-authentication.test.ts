import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device"
import { Verification } from "@octokit/auth-oauth-device/dist-types/types"
import puppeteerExtra from "puppeteer-extra"
import { expect } from "chai"
import { FirebaseApp } from "firebase/app"
import { GithubAuthProvider, OAuthCredential, UserCredential } from "firebase/auth"
import stealthPlugin from "puppeteer-extra-plugin-stealth"
import anonUA from "puppeteer-extra-plugin-anonymize-ua"
import { getCurrentFirebaseAuthUser, signInToFirebaseWithCredentials } from "../../src/index"
import {
    createNewFirebaseUserWithEmailAndPw,
    envType,
    getAuthenticationConfiguration,
    initializeUserServices,
    sleep
} from "../utils/index"
import { TestingEnvironment } from "../../types"

/**
 * Simulate callback to manage the data requested for Github OAuth2.0 device flow.
 * @param verification <Verification> - the data from Github OAuth2.0 device flow.
 */
const simulateOnVerification = async (verification: Verification): Promise<any> => {
    // 0.A Prepare data and plugin.
    const { userEmail, githubUserPw, gmailUserPw } = getAuthenticationConfiguration()
    puppeteerExtra.use(stealthPlugin())
    puppeteerExtra.use(anonUA())

    // 0.B Browser and pages.
    const browser = await puppeteerExtra.launch({ args: ["--no-sandbox"], headless: false, channel: "chrome" })
    const ghPage = await browser.newPage()
    const gmailPage = await browser.newPage()

    // 1. Navigate to Github login to execute device flow OAuth.
    ghPage.goto(verification.verification_uri)
    await Promise.race([
        ghPage.waitForNavigation({ waitUntil: "domcontentloaded" }),
        ghPage.waitForNavigation({ waitUntil: "load" })
    ])

    await ghPage.waitForSelector(`.js-login-field`, { timeout: 10000, visible: true })

    // Type data.
    await ghPage.type(".js-login-field", userEmail, { delay: 100 })
    await ghPage.type(".js-password-field", githubUserPw, { delay: 100 })

    // Confirm.
    await Promise.all([await ghPage.keyboard.press("Enter"), await ghPage.waitForNavigation()])

    // 2. Login to GMail.
    gmailPage.goto("https://www.gmail.com/")
    await Promise.race([
        gmailPage.waitForNavigation({ waitUntil: "domcontentloaded" }),
        gmailPage.waitForNavigation({ waitUntil: "load" })
    ])

    // Type mail.
    await gmailPage.waitForSelector('input[type="email"]')
    await gmailPage.click('input[type="email"]')
    await gmailPage.type('input[type="email"]', userEmail, { delay: 100 })
    await Promise.all([await gmailPage.keyboard.press("Enter"), await gmailPage.waitForNavigation()])

    // Wait for pw input focus.
    await sleep(2000) // due to page.waitForTimeout() deprecation. Suggested to use a custom promise.

    // Type pw.
    await gmailPage.waitForSelector('input[name="Passwd"]')
    await gmailPage.click('input[name="Passwd"]')
    await gmailPage.type('input[name="Passwd"]', gmailUserPw, { delay: 100 })
    await Promise.all([await gmailPage.keyboard.press("Enter"), await gmailPage.waitForNavigation()])

    // 1.2 Read Verification Code.
    await sleep(5000) // wait for new emails.

    const firstEmail = (await gmailPage.$$('tr[tabindex="-1"]'))[0]
    await firstEmail.click()

    await sleep(1000) // wait for open.

    // Extract verification code.
    const focusedSpans = await gmailPage.$$('span[class="im"]')
    const focusedSpan = focusedSpans[focusedSpans.length - 1]
    const parentDivElement = await focusedSpan.getProperty("parentElement")
    const parentTextContent = String(await (await parentDivElement.getProperty("textContent")).jsonValue())
    const verificationCodeSubStringIndex = parentTextContent.indexOf("code:", 0)
    // "code: " length 6 + 6 verification code length.
    const verificationCode = parentTextContent.substring(
        verificationCodeSubStringIndex + 6,
        verificationCodeSubStringIndex + 12
    )

    // 1.3 Input verification code and complete sign-in.
    await ghPage.waitForSelector(`.js-verification-code-input-auto-submit`, { timeout: 10000, visible: true })
    await ghPage.type(".js-verification-code-input-auto-submit", verificationCode, { delay: 100 })
    // Confirm.
    await Promise.all([await ghPage.keyboard.press("Enter"), await ghPage.waitForNavigation()])

    // 2. Insert code for device activation.
    // Get input slots for digits besides the fourth ('-' char).
    const userCode0 = await ghPage.$("#user-code-0")
    const userCode1 = await ghPage.$("#user-code-1")
    const userCode2 = await ghPage.$("#user-code-2")
    const userCode3 = await ghPage.$("#user-code-3")
    const userCode5 = await ghPage.$("#user-code-5")
    const userCode6 = await ghPage.$("#user-code-6")
    const userCode7 = await ghPage.$("#user-code-7")
    const userCode8 = await ghPage.$("#user-code-8")
    // Type digits.
    await userCode0?.type(verification.user_code[0], { delay: 100 })
    await userCode1?.type(verification.user_code[1], { delay: 100 })
    await userCode2?.type(verification.user_code[2], { delay: 100 })
    await userCode3?.type(verification.user_code[3], { delay: 100 })
    await userCode5?.type(verification.user_code[5], { delay: 100 })
    await userCode6?.type(verification.user_code[6], { delay: 100 })
    await userCode7?.type(verification.user_code[7], { delay: 100 })
    await userCode8?.type(verification.user_code[8], { delay: 100 })
    // Progress.
    const continueButton = await ghPage.$('[name="commit"]')
    await Promise.all([await continueButton?.click(), ghPage.waitForNavigation()])

    // 3. Confirm authorization for association of account and application.
    await sleep(2000) // wait for authorize button be clickable.

    const authorizeButton = await ghPage.$('[id="js-oauth-authorize-btn"]')
    await Promise.all([await authorizeButton?.click(), ghPage.waitForNavigation()])

    // 4. Check for completion and close browser.
    const completedTextElem = await ghPage.$("p[class='text-center']")
    await Promise.all([
        expect(await (await completedTextElem?.getProperty("textContent"))?.jsonValue()).to.be.equal(
            "Your device is now connected."
        ),
        await browser.close()
    ])
}

/**
 * E2E authentication tests.
 */
describe("Authentication", () => {
    // Prepare all necessary data to execute the e2e scenario flow.
    let clientId: string
    let firebaseUserApp: FirebaseApp
    let userEmailAddress: string
    const firebaseAuthUserPw = "abc123!"
    const clientType = "oauth-app"
    const tokenType = "oauth"

    beforeAll(async () => {
        // Get and assign configs.
        const { githubClientId, userEmail } = getAuthenticationConfiguration()
        clientId = githubClientId
        userEmailAddress = userEmail

        const { userApp } = initializeUserServices()
        firebaseUserApp = userApp
    })

    beforeEach(async () => {
        // Given: establish a known state to the system before each case.
    })

    it("authenticate a new user using Github OAuth 2.0 device flow", async () => {
        // Prepare data.
        const scopes = ["gist"]
        let userFirebaseCredentials: OAuthCredential | UserCredential

        // Create OAuth 2.0 with Github.
        const auth = createOAuthDeviceAuth({
            clientType,
            clientId,
            scopes,
            onVerification: simulateOnVerification
        })

        // Get the access token.
        const { token } = await auth({
            type: tokenType
        })

        // Development workflow: authenticate use through email/pw authentication when using the emulator.
        if (envType === TestingEnvironment.DEVELOPMENT)
            userFirebaseCredentials = await createNewFirebaseUserWithEmailAndPw(
                firebaseUserApp,
                userEmailAddress,
                firebaseAuthUserPw
            )
        else {
            // Remote workflow: Authenticate the user on Firebase authentication module.
            userFirebaseCredentials = GithubAuthProvider.credential(token)

            await signInToFirebaseWithCredentials(firebaseUserApp, userFirebaseCredentials)
        }

        // Then.
        const currentAuthUser = getCurrentFirebaseAuthUser(firebaseUserApp)

        expect(token).lengthOf(40)
        expect(token.startsWith("gho_")).to.be.equal(true)
        expect(currentAuthUser.uid.length > 0).to.be.equal(true)
    })

    it("should not be possible to authenticate twice", async () => {})

    it("should not be possible to authenticate if the user refuses to associate its Github account", async () => {})

    it("should not be possible to authenticate if the user send an expired device token", async () => {})

    it("should not be possible to authenticate if Github is unreachable", async () => {})

    it("should not be possible to authenticate if Firebase is unreachable", async () => {})

    it("should not be possible to authenticate if the user has been disabled from the Authentication service by coordinator", async () => {})

    afterAll(async () => {
        // Finally: revert the state back to pre-given state. This section is executed even if when or then fails.
    })
})
