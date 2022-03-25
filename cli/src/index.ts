#!/usr/bin/env node

import { createCommand } from "commander"
import { prepare, login } from "./commands/index.js"
import readJSONFile from "./lib/files.js"

const pkg = readJSONFile("./package.json")

const program = createCommand()

program
  .name("phase2cli")
  .description("MPC Phase 2 Suite CLI for conducting zkSNARKs Trusted Setup ceremonies")
  .version(pkg.version)

program
  .command("login")
  .description("authorize the user into Firebase using Github OAuth 2.0 Device Flow")
  .action(login)

const ceremony = program.command("ceremony").description("manage ceremonies (only coordinators)")

ceremony.command("prepare").description("prepare a new ceremony").action(prepare)

program.parseAsync()
