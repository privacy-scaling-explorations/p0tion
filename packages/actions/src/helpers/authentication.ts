import { User, getAuth, signInWithCredential, initializeAuth, OAuthCredential } from "firebase/auth"
import { FirebaseApp } from "firebase/app" // ref https://firebase.google.com/docs/web/setup#access-firebase.

/**
 * Sign in w/ OAuth 2.0 token.
 * @param firebaseApp <FirebaseApp> - the configured instance of the Firebase App in use.
 * @param credentials <OAuthCredential> - the OAuth credential generated from token exchange.
 */
export const signInToFirebaseWithCredentials = async (firebaseApp: FirebaseApp, credentials: OAuthCredential) =>
    signInWithCredential(initializeAuth(firebaseApp), credentials)

/**
 * Return the current authenticated user in the given Firebase Application.
 * @param firebaseApp <FirebaseApp> - the configured instance of the Firebase App in use.
 * @returns <User> - the object containing the data about the current authenticated user in the given Firebase application.
 */
export const getCurrentFirebaseAuthUser = (firebaseApp: FirebaseApp): User => {
    const user = getAuth(firebaseApp).currentUser

    if (!user)
        throw new Error(
            `Unable to find the user currently authenticated with Firebase. Verify that the Firebase application is properly configured and repeat user authentication before trying again.`
        )

    return user
}

/**
 * Check if the user can claim to be a coordinator.
 * @param user <User> - the user to be checked.
 * @returns Promise<boolean> - true if the user is a coordinator, false otherwise.
 */
export const isCoordinator = async (user: User) => {
    const userTokenAndClaims = await user.getIdTokenResult()

    return !!userTokenAndClaims.claims.coordinator
}

export const isCoordinatorAPI = async (token: string, ceremonyId: number) => {
    const url = new URL(`${process.env.API_URL}/ceremonies/is-coordinator`)
    url.search = new URLSearchParams({ ceremonyId: ceremonyId.toString() }).toString()
    const result = (await fetch(url.toString(), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    }).then((res) => res.json())) as { isCoordinator: boolean }
    return result.isCoordinator
}
