export {
    envType,
    initializeAdminServices,
    initializeUserServices,
    getStorageConfiguration,
    getAuthenticationConfiguration,
    deleteAdminApp,
    sleep,
    generatePseudoRandomStringOfNumbers
} from "./configs"

export {
    createNewFirebaseUserWithEmailAndPw,
    getLastGithubVerificationCode,
    simulateOnVerification,
    authenticateUserWithGithub
} from "./authentication"
