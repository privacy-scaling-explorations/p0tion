import { initializeAdminServices } from "./configs"

/**
 * Give coordinator rights to a list of users.
 * Utility only to be used for hackathon purposes.
 */
const main = async () => {
    const { adminAuth } = initializeAdminServices()

    // "add" or "remove"
    const option = process.argv[2]
    if (!option || (option !== "add" && option !== "remove")) {
        throw new Error("Can either add or remove")
    }

    console.log(`[i] ${option === "add" ? 'Giving' : 'Removing'} coordinator rights`)

    // from argv[3]
    for (const arg of process.argv.slice(3)) {
        try {
            await adminAuth.setCustomUserClaims(arg, { coordinator: option === "add" ? true : false })
            console.log(`[+] ${option === "add" ? 'Added' : 'Removed'} coordinator rights ${option === "add" ? 'to' : 'from'} user ${arg}`)
        } catch (err: any) {
            console.log(`[-] Could not ${option === "add" ? 'add' : 'remove'} coordinator rights ${option === "add" ? 'to' : 'from'} user ${arg}`)
        }
    }
}

main().catch()