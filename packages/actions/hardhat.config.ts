import "@nomiclabs/hardhat-ethers"
import "./src/helpers/tasks"
import { HardhatUserConfig } from "hardhat/types/index"

const config: HardhatUserConfig = {
    solidity: "0.8.18",
    paths: {
        sources: "./test/data/artifacts",
        artifacts: "./artifacts"
    }
}

export default config
