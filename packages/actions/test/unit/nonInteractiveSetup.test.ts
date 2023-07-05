import { cwd } from "process"
import {
    parseCeremonyFile
} from "../../src/"

describe("non interactive setup", () => {
    const path = `${cwd()}/packages/actions/test/data/artifacts/ceremonySetup.json`

    it("should parse the file", () => {
        parseCeremonyFile(path)
    })
})