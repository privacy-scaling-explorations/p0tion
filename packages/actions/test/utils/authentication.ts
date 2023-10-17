import { google } from "googleapis"
import { createUserWithEmailAndPassword, getAuth, UserCredential } from "firebase/auth"
import { FirebaseApp } from "firebase/app"
import { Auth } from "firebase-admin/auth"
import { getCurrentFirebaseAuthUser } from "../../src/index"
import { UserDocumentReferenceAndData } from "../../src/types/index"

/**
 * Sleeps the function execution for given millis.
 * @dev to be used in combination with loggers when writing data into files.
 * @param ms <number> - sleep amount in milliseconds
 * @returns <Promise<any>>
 */
export const sleep = (ms: any) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Return a pseudo random string of numeric values of specified length.
 * @param length <string> - the number of values.
 * @returns <string> - a pseudo random string of numeric values.
 */
export const generatePseudoRandomStringOfNumbers = (length: number): string => Math.random().toString(length)

/**
 * Create a new Firebase user account with specified email and password.
 * @notice On successful creation of the user account, this user will also be signed in to your application.
 * @dev The pw MUST not be the one used for login with the email on Google or other email providers. The pw is only valid for authentication with Firebase.
 * @param userApp <FirebaseApp> - the initialized instance of the Firebase app.
 * @param email <string> - the personal user email.
 * @param pw <string> - a password to be associated with the user personal email here in Firebase.
 * @returns <Promise<UserCredential>>
 */
export const createNewFirebaseUserWithEmailAndPw = async (
    userApp: FirebaseApp,
    email: string,
    pw: string
): Promise<UserCredential> => createUserWithEmailAndPassword(getAuth(userApp), email, pw)

/**
 * Return the verification code needed to complete the access with Github.
 * @param gmailUserEmail <string> - the GMail email address.
 * @param gmailClientId <string> - the GMail client identifier.
 * @param gmailClientSecret <string> - the GMail client secret.
 * @param gmailRedirectUrl <string> - the GMail redirect url.
 * @param gmailRefreshToken <string> - the GMail refresh token.
 * @dev You should have the GMail APIs for OAuth2.0 must be enabled and configured properly in order to get correct results.
 * @returns <Promise<string>> - return the 6 digits verification code needed to complete the access with Github.
 * @todo this method will not be used for testing right now. See PR #286 and #289 for info.
 */
export const getLastGithubVerificationCode = async (
    gmailUserEmail: string,
    gmailClientId: string,
    gmailClientSecret: string,
    gmailRedirectUrl: string,
    gmailRefreshToken: string
): Promise<string> => {
    // Configure Google OAuth2.0 client.
    const oAuth2Client = new google.auth.OAuth2(gmailClientId, gmailClientSecret, gmailRedirectUrl)
    oAuth2Client.setCredentials({ refresh_token: gmailRefreshToken })
    // Get access token.
    const { token } = await oAuth2Client.getAccessToken()

    // Fetch messages (emails) and retrieve the id of the last one.
    let response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/${gmailUserEmail}/messages`, {
        headers: {
            authorization: `Bearer ${token}`
        }
    })
    let body: any = await response.json()
    const lastMsgId = body.messages[0].id

    // Read last message using id.
    response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/${gmailUserEmail}/messages/${lastMsgId}`, {
        headers: {
            authorization: `Bearer ${token}`
        }
    })
    body = await response.json()
    // Convert buffer.
    const message = Buffer.from(body.payload.body.data, "base64").toString()
    // Get OTP verification code.
    const otp = message.match(/[0-9]{6}/)?.toString()

    if (!otp) throw new Error("OTP code could not be retrieved.")

    return otp
}

/**
 * Test function to set custom claims of a user.
 * @param adminAuth <Auth> - the admin auth instance.
 * @param userId <string> - the uid of the user to add the privileges to.
 * @param claims <{ [key: string]: boolean }> - the claims to set.
 * @returns
 */
export const setCustomClaims = async (
    adminAuth: Auth,
    userId: string,
    claims: { [key: string]: boolean }
): Promise<void> => adminAuth.setCustomUserClaims(userId, claims)

/**
 * Test function to create a new user
 * @param userApp <FirebaseApp> - the Firebase user Application instance.
 * @param email <string> - the email of the user.
 * @param password <string> - the password of the user.
 * @param isUserCoordinator <boolean> - whether the user is a coordinator or not.
 * @param adminAuth <Auth> - the admin auth instance.
 */
export const createMockUser = async (
    userApp: FirebaseApp,
    email: string,
    password: string,
    isUserCoordinator: boolean = true,
    adminAuth?: Auth
): Promise<string> => {
    await createNewFirebaseUserWithEmailAndPw(userApp, email, password)

    await sleep(5000)

    const currentAuthenticatedUser = getCurrentFirebaseAuthUser(userApp)
    const uid = currentAuthenticatedUser?.uid

    if (isUserCoordinator) {
        if (!adminAuth) throw new Error("Admin auth instance is required to set a user as coordinator.")
        await setCustomClaims(adminAuth, uid, { coordinator: true })
        await sleep(2000)
        // refresh the token.
        await getCurrentFirebaseAuthUser(userApp)?.getIdToken(true)
    }

    return uid
}

/**
 * Generate a list of random passwords.
 * @param numberOfUsers <number> - the number of users to generate passwords for.
 * @returns <string[]> - the list of passwords.
 */
export const generateUserPasswords = (numberOfUsers: number): string[] => {
    const passwords: string[] = []
    for (let i = 0; i < numberOfUsers; i++) {
        const password = generatePseudoRandomStringOfNumbers(24)
        passwords.push(password)
    }
    return passwords
}

/**
 * Clean up the db and app by removing users created for testing.
 * @param adminAuth <Auth> - the admin auth instance.
 * @param adminFirestore <Firestore> - the admin firestore instance.
 * @param uids <string[]> - the list of uids to delete.
 */
export const cleanUpMockUsers = async (
    adminAuth: Auth,
    adminFirestore: FirebaseFirestore.Firestore,
    users: UserDocumentReferenceAndData[]
): Promise<void> => {
    for (let i = 0; i < users.length; i++) {
        await adminAuth.deleteUser(users[i].uid)
        await adminFirestore.collection("users").doc(users[i].uid).delete()
    }
}
