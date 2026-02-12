#!/usr/bin/env node

/**
 * CAAMP CLI - Central AI Agent Managed Packages
 */

import { Command } from "commander";
import { registerProvidersCommand } from "./commands/providers.js";
import { registerSkillsCommands } from "./commands/skills/index.js";
import { registerMcpCommands } from "./commands/mcp/index.js";
import { registerInstructionsCommands } from "./commands/instructions/index.js";
import { registerConfigCommand } from "./commands/config.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerAdvancedCommands } from "./commands/advanced/index.js";
import { setVerbose, setQuiet } from "./core/logger.js";

const program = new Command();

program
  .name("caamp")
  .description("Central AI Agent Managed Packages - unified provider registry and package manager")
  .version("0.3.0")
  .option("-v, --verbose", "Show debug output")
  .option("-q, --quiet", "Suppress non-error output");

program.hook("preAction", (thisCommand) => {
  const opts = thisCommand.optsWithGlobals();
  if (opts.verbose) setVerbose(true);
  if (opts.quiet) setQuiet(true);
});

// Register command groups
registerProvidersCommand(program);
registerSkillsCommands(program);
registerMcpCommands(program);
registerInstructionsCommands(program);
registerConfigCommand(program);
registerDoctorCommand(program);
registerAdvancedCommands(program);

program.parse();
