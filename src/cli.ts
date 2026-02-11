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

const program = new Command();

program
  .name("caamp")
  .description("Central AI Agent Managed Packages - unified provider registry and package manager")
  .version("0.2.0");

// Register command groups
registerProvidersCommand(program);
registerSkillsCommands(program);
registerMcpCommands(program);
registerInstructionsCommands(program);
registerConfigCommand(program);

program.parse();
