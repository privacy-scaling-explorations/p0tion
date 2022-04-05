#!/usr/bin/env node

import { createCommand } from "commander"
import { setup, auth, contribute } from "./commands/index.js"
import { readJSONFile } from "./lib/files.js"

const pkg = readJSONFile("./package.json")

const program = createCommand()

program
  .name("phase2cli")
  .description("CLI for coordinating and/or participating in MPC Trusted Setup Phase 2 ceremonies")
  .version(pkg.version)

// Only coordinator commands.
program.command("auth").description("authentication via Github OAuth 2.0").action(auth)
program.command("contribute").description("compute a contribution for ceremony circuit(s)").action(contribute)

// Coordinator and participant commands.
const ceremony = program.command("ceremony").description("manage ceremonies (only coordinators)")

ceremony
  .command("setup")
  .description("setup a Groth16 Phase 2 Trusted Setup ceremony for multiple and large zk-SNARK circuits")
  .action(setup)

program.parseAsync()
