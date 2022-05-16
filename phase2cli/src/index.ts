#!/usr/bin/env node

import { createCommand } from "commander"
import { setup, auth, contribute, observe } from "./commands/index.js"
import { readLocalJsonFile } from "./lib/utils.js"

const pkg = readLocalJsonFile("../../package.json")

const program = createCommand()

// Entry point.
program.name(pkg.name).description(pkg.description).version(pkg.version)

// User commands.
program.command("auth").description("authenticate yourself using your Github account (OAuth 2.0)").action(auth)
program
  .command("contribute")
  .description("compute your own contribution on any circuit within a chosen ceremony")
  .action(contribute)

// Only coordinator commands.
const ceremony = program.command("ceremony").description("exclusive commands for ceremonies coordinators")

ceremony
  .command("setup")
  .description("setup a Groth16 Phase 2 Trusted Setup ceremony for multiple and large zk-SNARK circuits")
  .action(setup)

ceremony
  .command("observe")
  .description("real-time observation of a ceremony circuit waiting queue updates")
  .action(observe)

program.parseAsync()
