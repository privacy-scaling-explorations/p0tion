import { StartMultiPartUploadDataDto } from "./storage-dto"

describe("StorageDto", () => {
    it("should be defined", () => {
        expect(new StartMultiPartUploadDataDto()).toBeDefined()
    })
})
