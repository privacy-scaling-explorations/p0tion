#!/usr/bin/env node

import { createCommand } from "commander"
import { setup, auth, contribute, observe, finalize } from "./commands/index.js"
import { readLocalJsonFile } from "./lib/files.js"

// Get pkg info (e.g., name, version).
const pkg = readLocalJsonFile("../../package.json")

const program = createCommand()

// Entry point.
program.name(pkg.name).description(pkg.description).version(pkg.version)

// User commands.
program.command("auth").description("authenticate yourself using your Github account (OAuth 2.0)").action(auth)
program
  .command("contribute")
  .description("compute contributions for a Phase2 Trusted Setup ceremony circuits")
  .action(contribute)

// Only coordinator commands.
const ceremony = program.command("coordinate").description("coordinator only commands for coordinating a ceremony")

ceremony
  .command("setup")
  .description("setup a Groth16 Phase 2 Trusted Setup ceremony for zk-SNARK circuits")
  .action(setup)

ceremony
  .command("observe")
  .description("observe in real-time what is happening in the waiting queue of each ceremony circuit")
  .action(observe)

ceremony
  .command("finalize")
  .description(
    "finalize a ceremony carrying out various steps (apply beacon, verify final zkey, export verification key, turn the verifier as Ethereum smart contract)"
  )
  .action(finalize)

program.parseAsync()
