import * as fs from "fs"
import typescript from "rollup-plugin-typescript2"
import autoExternal from "rollup-plugin-auto-external"
import cleanup from "rollup-plugin-cleanup"

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"))
const banner = `#!/usr/bin/env node

/**
 * @module ${pkg.name}
 * @version ${pkg.version}
 * @file ${pkg.description}
 * @copyright Ethereum Foundation 2022
 * @license ${pkg.license}
 * @see [Github]{@link ${pkg.homepage}}
*/`

export default {
    input: "src/index.ts",
    output: [{ file: pkg.main, format: "es", banner }],
    plugins: [
        autoExternal(),
        (typescript as any)({
            tsconfig: "./build.tsconfig.json",
            useTsconfigDeclarationDir: true
        }),
        cleanup({ comments: "jsdoc" })
    ]
}
