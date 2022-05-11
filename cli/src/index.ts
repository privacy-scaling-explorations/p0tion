#!/usr/bin/env node

import { createCommand } from "commander"
import { setup, auth, contribute, observe } from "./commands/index.js"
import { readLocalJsonFile } from "./lib/utils.js"

const pkg = readLocalJsonFile("../../package.json")

const program = createCommand()

program
  .name("phase2cli")
  .description("CLI for coordinating and/or participating in MPC Trusted Setup Phase 2 ceremonies")
  .version(pkg.version)

// Coordinator and participants commands.
program.command("auth").description("authentication via Github OAuth 2.0").action(auth)
program.command("contribute").description("compute a contribution for ceremony circuit(s)").action(contribute)

// Only coordinator commands.
const ceremony = program.command("ceremony").description("manage ceremonies (only coordinators)")

ceremony
  .command("setup")
  .description("setup a Groth16 Phase 2 Trusted Setup ceremony for multiple and large zk-SNARK circuits")
  .action(setup)

ceremony
  .command("observe")
  .description("observe the ceremony progress for one specific (or all) circuit(s)")
  .action(observe)

program.parseAsync()
