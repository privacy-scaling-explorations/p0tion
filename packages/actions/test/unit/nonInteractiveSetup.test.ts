import { cwd } from "process"
import {
    TestingEnvironment,
    parseCeremonyFile
} from "../../src/"
import { envType } from "../utils"
import { expect } from "chai"

describe("non interactive setup", () => {
    let path: string = ""

    if (envType === TestingEnvironment.PRODUCTION)
        path = `${cwd()}/packages/actions/test/data/artifacts/ceremonySetup.json`
    else path = `${cwd()}../../packages/actions/test/data/artifacts/ceremonySetup.json`
    
    it("return the parsed object", () => {
        expect(parseCeremonyFile(path)).to.not.throw
    })
    it("should throw when given an invalid path", () => {
        expect(() => parseCeremonyFile("invalid path")).to.throw
    })
    
    it("should throw when given an invalid timeout type", () => {})
    it("should throw when given invalid circuit data", () => {})
    it("should throw when given an invalid end date", () => {})
    it("should throw when given an invalid start date", () => {})
    it("should throw when given an invalid penalty", () => {})


})